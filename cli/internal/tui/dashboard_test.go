package tui

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
)

// stub answers Convex calls from a table of function path to return value.
// Anything not in the table is an error, which is what the dashboard would see
// from a backend that refused the call.
func stub(t *testing.T, values map[string]any) *api.Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var call struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
			t.Errorf("bad request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		value, ok := values[call.Path]
		if !ok {
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "error", "errorMessage": "no stub for " + call.Path})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "success", "value": value})
	}))
	t.Cleanup(server.Close)
	return api.New(server.URL, "hp_test")
}

// isolateConfig points the config file at a temporary directory, so a test that
// saves one never touches the developer's own.
func isolateConfig(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("AppData", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HILLPOST_TOKEN", "")
}

// loggedIn returns a dashboard already showing the home menu for one role.
func loggedIn(t *testing.T, c *api.Client, role string) Dashboard {
	t.Helper()
	d := NewDashboard(c, config.Config{HackathonID: "hack_1", HackathonName: "CLI verify"})
	next, _ := d.Update(homeMsg{me: &api.WhoAmI{
		UserID:   "user_1",
		UserName: "Test User",
		Memberships: []api.Membership{
			{HackathonID: "hack_1", Name: "CLI verify", Role: role, Status: "approved", IsActive: true},
		},
	}})
	return next.(Dashboard)
}

func press(d Dashboard, keys ...string) Dashboard {
	for _, k := range keys {
		next, _ := d.Update(key(k))
		d = next.(Dashboard)
	}
	return d
}

// focus moves the menu cursor onto the item with this key.
func focus(t *testing.T, d Dashboard, want string) Dashboard {
	t.Helper()
	for i, it := range d.menu {
		if it.key == want {
			d.cursor = i
			return d
		}
	}
	t.Fatalf("no %q item in the menu: %v", want, d.menu)
	return d
}

func labels(d Dashboard) []string {
	out := make([]string, 0, len(d.menu))
	for _, it := range d.menu {
		out = append(out, it.key)
	}
	return out
}

func TestMenuFollowsMyRole(t *testing.T) {
	everyone := []string{"join", "discover", "create", "logout"}
	cases := map[string][]string{
		"competitor": {"team", "submit", "submissions", "leaderboard"},
		"judge":      {"judge", "leaderboard"},
		"organizer":  {"overview", "categories", "members", "submissions", "leaderboard"},
	}
	for role, want := range cases {
		d := loggedIn(t, nil, role)
		if got := labels(d); !strings.HasPrefix(strings.Join(got, " "), strings.Join(want, " ")) {
			t.Errorf("%s menu = %v, want it to start with %v", role, got, want)
		}
		if !strings.HasSuffix(strings.Join(labels(d), " "), strings.Join(everyone, " ")) {
			t.Errorf("%s menu = %v, want it to end with %v", role, labels(d), everyone)
		}
	}
}

func TestLoggedOutHomeOffersLogin(t *testing.T) {
	d := NewDashboard(nil, config.Config{})
	next, _ := d.Update(homeMsg{})
	d = next.(Dashboard)

	if got := labels(d); len(got) != 1 || got[0] != "login" {
		t.Errorf("a logged-out dashboard offers only a login, got %v", got)
	}
	if !strings.Contains(d.View(), "Welcome to Hillpost") {
		t.Errorf("the welcome screen should say what this is:\n%s", d.View())
	}
}

func TestSwitchAppearsOnlyWithSomewhereToSwitchTo(t *testing.T) {
	d := loggedIn(t, nil, "competitor")
	if strings.Contains(strings.Join(labels(d), " "), "switch") {
		t.Error("one hackathon is nothing to switch between")
	}

	next, _ := d.Update(homeMsg{me: &api.WhoAmI{UserName: "Test User", Memberships: []api.Membership{
		{HackathonID: "hack_1", Name: "CLI verify", Role: "competitor"},
		{HackathonID: "hack_2", Name: "Second", Role: "judge"},
	}}})
	if !strings.Contains(strings.Join(labels(next.(Dashboard)), " "), "switch") {
		t.Errorf("two hackathons can be switched between, got %v", labels(next.(Dashboard)))
	}
}

func TestMenuNavigationAndHelpFooter(t *testing.T) {
	d := loggedIn(t, nil, "competitor")
	if d = press(d, "k"); d.cursor != 0 {
		t.Errorf("k at the top stays put, got %d", d.cursor)
	}
	if d = press(d, "j", "j"); d.cursor != 2 {
		t.Errorf("j moves down, got %d", d.cursor)
	}
	if d = press(d, "up"); d.cursor != 1 {
		t.Errorf("up moves back, got %d", d.cursor)
	}

	if strings.Contains(d.View(), "esc back") {
		t.Error("the help footer is hidden until it is asked for")
	}
	d = press(d, "?")
	if !strings.Contains(d.View(), "esc back") {
		t.Errorf("? should show the keys:\n%s", d.View())
	}
	if d = press(d, "?"); strings.Contains(d.View(), "esc back") {
		t.Error("? should hide them again")
	}
}

func TestQuitsFromHomeAndGoesBackFromAScreen(t *testing.T) {
	d := loggedIn(t, nil, "competitor")
	_, cmd := d.Update(key("q"))
	if cmd == nil {
		t.Fatal("q at home should quit")
	}
	if _, ok := cmd().(tea.QuitMsg); !ok {
		t.Error("q at home returns tea.Quit")
	}

	next, _ := d.Update(pageMsg{page: &textPage{heading: "Submissions", body: "nothing yet"}})
	d = next.(Dashboard)
	if d.View() == "" || !strings.Contains(d.View(), "Submissions") {
		t.Errorf("the pushed screen is what is shown:\n%s", d.View())
	}

	_, cmd = d.Update(key("esc"))
	if cmd == nil {
		t.Fatal("esc on a screen goes back")
	}
	next, _ = d.Update(cmd().(popMsg))
	if len(next.(Dashboard).pages) != 0 {
		t.Error("going back leaves the home menu")
	}
}

func TestOpeningTheLeaderboardLoadsItInTheBackground(t *testing.T) {
	c := stub(t, map[string]any{
		"leaderboard:get": map[string]any{
			"maxPossibleScore":  20,
			"leaderboardHidden": false,
			"entries": []any{map[string]any{
				"rank": 1, "teamId": "team_1", "teamName": "Otters",
				"averageScore": 17.5, "overallScore": 17.5, "totalJudgeCount": 2,
				"categoryScores": []any{},
			}},
		},
	})
	d := focus(t, loggedIn(t, c, "competitor"), "leaderboard")

	next, cmd := d.Update(key("enter"))
	d = next.(Dashboard)
	if cmd == nil {
		t.Fatal("enter should start loading")
	}
	if d.busy == "" {
		t.Error("the footer should say what it is waiting for")
	}

	msg, ok := cmd().(pageMsg)
	if !ok || msg.err != nil {
		t.Fatalf("the leaderboard should load, got %+v", msg)
	}
	next, _ = d.Update(msg)
	d = next.(Dashboard)
	if !strings.Contains(d.View(), "Otters") {
		t.Errorf("the leaderboard should be on screen:\n%s", d.View())
	}
	if d.busy != "" {
		t.Error("loading is over once the screen is up")
	}
}

func TestABackendErrorIsShownAndNoScreenOpens(t *testing.T) {
	d := loggedIn(t, stub(t, nil), "organizer")
	d = focus(t, d, "members")

	_, cmd := d.Update(key("enter"))
	next, _ := d.Update(cmd().(pageMsg))
	d = next.(Dashboard)

	if len(d.pages) != 0 {
		t.Error("a failed load opens nothing")
	}
	if !strings.Contains(d.View(), "no stub for members:listMembers") {
		t.Errorf("the backend message is shown as it came:\n%s", d.View())
	}
}

func TestMembersScreenApprovesInPlace(t *testing.T) {
	c := stub(t, map[string]any{
		"members:listMembers": []any{
			map[string]any{"_id": "mem_1", "userName": "Judge Jo", "role": "judge", "status": "pending"},
		},
		"members:updateStatus": nil,
	})
	p, err := membersPage(t.Context(), c, "hack_1")
	if err != nil {
		t.Fatalf("membersPage: %v", err)
	}
	if !strings.Contains(p.view(80, 10), "pending") {
		t.Errorf("a pending judge should be marked:\n%s", p.view(80, 10))
	}

	_, cmd := p.update(key("a"))
	if cmd == nil {
		t.Fatal("a should approve the member under the cursor")
	}
	msg, ok := cmd().(rowDetailMsg)
	if !ok {
		t.Fatalf("approving should report the new status, got %#v", cmd())
	}
	p, _ = p.update(msg)
	if !strings.Contains(p.view(80, 10), "approved") {
		t.Errorf("the row should show the new status:\n%s", p.view(80, 10))
	}
}

func TestLoginScreenPollsUntilApproved(t *testing.T) {
	isolateConfig(t)
	p := &loginScreen{
		client: stub(t, nil),
		device: api.DeviceLogin{DeviceCode: "dev_1", UserCode: "ABCD-EFGH", VerificationURL: "https://hillpost.dev/cli/login?code=ABCD-EFGH"},
	}
	if !strings.Contains(p.view(80, 10), "ABCD-EFGH") {
		t.Errorf("the code is what the user types in the browser:\n%s", p.view(80, 10))
	}

	// Still pending: keep waiting, and say so.
	next, cmd := p.update(claimMsg{deviceCode: "dev_1", claim: api.DeviceClaim{Status: "pending"}})
	if cmd == nil {
		t.Fatal("a pending device should be asked about again")
	}
	if !strings.Contains(next.view(80, 10), "Waiting for you to approve") {
		t.Errorf("the wait should explain itself:\n%s", next.view(80, 10))
	}

	// Approved: hand the token to the dashboard, which saves it.
	next, cmd = next.update(claimMsg{deviceCode: "dev_1", claim: api.DeviceClaim{Status: "approved", Token: "hp_new", UserName: "Test User"}})
	if cmd == nil {
		t.Fatal("an approved device should log in")
	}
	logged, ok := cmd().(loggedInMsg)
	if !ok || logged.token != "hp_new" {
		t.Fatalf("expected the new token, got %#v", cmd())
	}

	c := api.New("http://127.0.0.1:1", "")
	d := NewDashboard(c, config.Config{})
	if _, cmd := d.Update(logged); cmd == nil {
		t.Error("logging in should reload the home screen")
	}
	if c.Token != "hp_new" {
		t.Errorf("the client should carry the new token, got %q", c.Token)
	}
	saved, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load: %v", err)
	}
	if saved.Token != "hp_new" {
		t.Errorf("the token should be saved, got %q", saved.Token)
	}
}

func TestAnExpiredLoginSaysSo(t *testing.T) {
	p := &loginScreen{client: stub(t, nil), device: api.DeviceLogin{DeviceCode: "dev_1"}}
	next, cmd := p.update(claimMsg{deviceCode: "dev_1", claim: api.DeviceClaim{Status: "expired"}})
	if cmd != nil {
		t.Error("an expired code is the end of the flow")
	}
	if !strings.Contains(next.view(80, 10), "expired") {
		t.Errorf("the user should be told to start again:\n%s", next.view(80, 10))
	}
}

func TestLogOutForgetsTheToken(t *testing.T) {
	isolateConfig(t)
	c := api.New("http://127.0.0.1:1", "hp_test")
	d := loggedIn(t, c, "competitor")
	d = focus(t, d, "logout")

	next, _ := d.Update(key("enter"))
	d = next.(Dashboard)
	if c.Token != "" || d.me != nil {
		t.Error("logging out drops the token and the user")
	}
	if got := labels(d); len(got) != 1 || got[0] != "login" {
		t.Errorf("the menu goes back to a login, got %v", got)
	}
	saved, _ := config.Load()
	if saved.Token != "" {
		t.Errorf("the saved token should be gone, got %q", saved.Token)
	}
}

func TestFitsEightyByTwentyFourEverywhere(t *testing.T) {
	d := loggedIn(t, nil, "organizer")
	views := []string{d.View()}

	withHelp := press(d, "?")
	views = append(views, withHelp.View())

	pages := []page{
		&textPage{heading: "Overview", body: overviewView(api.Hackathon{
			Name: "CLI verify", ID: "hack_1", StartDate: 1757808000000, EndDate: 1757908000000,
			SubmissionFrequencyMinutes: 30, IsActive: true, IsPublic: true,
			CompetitorJoinCode: "ABC123", JudgeJoinCode: "XYZ789",
		})},
		&listPage{heading: "Members", rows: []listRow{{id: "m1", name: "Test User", detail: "organizer  approved"}}},
		&loginScreen{device: api.DeviceLogin{UserCode: "ABCD-EFGH", VerificationURL: "https://hillpost.dev/cli/login?code=ABCD-EFGH"}},
	}
	for _, p := range pages {
		next, _ := d.Update(pageMsg{page: p})
		views = append(views, next.(Dashboard).View())
	}

	for i, view := range views {
		lines := strings.Split(view, "\n")
		if len(lines) > 24 {
			t.Errorf("view %d is %d lines, more than 24 fit", i, len(lines))
		}
		for n, line := range lines {
			if w := lipgloss.Width(line); w > 80 {
				t.Errorf("view %d line %d is %d columns wide: %q", i, n, w, line)
			}
		}
	}
}
