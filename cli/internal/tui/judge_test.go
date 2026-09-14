package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

func testData() JudgeData {
	return JudgeData{
		HackathonName: "E2E 57",
		JudgeID:       "judge_1",
		Submissions: []api.Submission{
			{ID: "sub_a", TeamID: "team_a", Name: "Aardvark", Description: "First project", ProjectURL: "https://example.com/a", SubmissionCount: 1},
			{ID: "sub_b", TeamID: "team_b", Name: "Bison", Description: "Second project", ProjectURL: "https://example.com/b", SubmissionCount: 2, JudgedBy: []string{"judge_1"}},
		},
		TeamNames:  map[string]string{"team_a": "Team A", "team_b": "Team B"},
		Categories: []api.Category{{ID: "cat_1", Name: "Creativity", MaxScore: 10}, {ID: "cat_2", Name: "Execution", MaxScore: 5}},
	}
}

func key(s string) tea.KeyMsg {
	switch s {
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	case "tab":
		return tea.KeyMsg{Type: tea.KeyTab}
	case "esc":
		return tea.KeyMsg{Type: tea.KeyEscape}
	}
	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
}

func send(m Judge, keys ...string) Judge {
	for _, k := range keys {
		next, _ := m.Update(key(k))
		m = next.(Judge)
	}
	return m
}

func TestNewJudgeMarksWhatIAlreadyScored(t *testing.T) {
	m := NewJudge(nil, testData())
	if m.scored["sub_a"] {
		t.Error("sub_a has no scores from me")
	}
	if !m.scored["sub_b"] {
		t.Error("sub_b lists me in judgedBy, so it is scored")
	}
	if !strings.Contains(m.View(), "[x] Team B - Bison") {
		t.Errorf("the list should mark the scored submission:\n%s", m.View())
	}
}

func TestListNavigation(t *testing.T) {
	m := NewJudge(nil, testData())
	if m = send(m, "k"); m.cursor != 0 {
		t.Errorf("k at the top should stay put, got %d", m.cursor)
	}
	if m = send(m, "j"); m.cursor != 1 {
		t.Errorf("j should move down, got %d", m.cursor)
	}
	if m = send(m, "j", "j"); m.cursor != 1 {
		t.Errorf("j at the bottom should stay put, got %d", m.cursor)
	}
	if m = send(m, "k"); m.cursor != 0 {
		t.Errorf("k should move up, got %d", m.cursor)
	}
}

func TestQuitFromTheList(t *testing.T) {
	m := NewJudge(nil, testData())
	_, cmd := m.Update(key("q"))
	if cmd == nil {
		t.Fatal("q should quit")
	}
	if _, ok := cmd().(tea.QuitMsg); !ok {
		t.Error("q should return tea.Quit")
	}
}

func TestEnterOpensScoringAndPreFillsMyScores(t *testing.T) {
	m := NewJudge(nil, testData())
	m = send(m, "enter")
	if !m.scoring || !m.loading {
		t.Fatalf("enter should open the scoring view and start loading, got scoring=%v loading=%v", m.scoring, m.loading)
	}

	next, _ := m.Update(myScoresMsg{
		submissionID: "sub_a",
		scores: []api.Score{
			{CategoryID: "cat_1", Score: 8, Feedback: "Nice idea"},
			{CategoryID: "cat_2", Score: 3},
		},
	})
	m = next.(Judge)
	if m.loading {
		t.Error("the scores arrived, so loading is over")
	}
	if got := m.inputs[0].Value(); got != "8" {
		t.Errorf("category 1 should be pre-filled with 8, got %q", got)
	}
	if got := m.inputs[1].Value(); got != "3" {
		t.Errorf("category 2 should be pre-filled with 3, got %q", got)
	}
	if got := m.inputs[2].Value(); got != "Nice idea" {
		t.Errorf("feedback should be pre-filled, got %q", got)
	}
}

func TestScoringKeysAndDigitFilter(t *testing.T) {
	m := NewJudge(nil, testData())
	m = send(m, "enter")
	next, _ := m.Update(myScoresMsg{submissionID: "sub_a"})
	m = next.(Judge)

	// Letters never reach a numeric field.
	m = send(m, "7", "x", "9")
	if got := m.inputs[0].Value(); got != "79" {
		t.Errorf("numeric fields take digits only, got %q", got)
	}

	if m = send(m, "tab"); m.focus != 1 {
		t.Errorf("tab should move to the next field, got %d", m.focus)
	}
	m = send(m, "tab") // the feedback field
	m = send(m, "s", "o")
	if got := m.inputs[2].Value(); got != "so" {
		t.Errorf("letters typed in the feedback field are text, got %q", got)
	}

	// esc returns to the list without sending anything.
	if m = send(m, "esc"); m.scoring {
		t.Error("esc should return to the list")
	}
}

func TestSubmitRefusesAnOutOfRangeScore(t *testing.T) {
	m := NewJudge(nil, testData())
	m = send(m, "enter")
	next, _ := m.Update(myScoresMsg{submissionID: "sub_a"})
	m = next.(Judge)

	m.inputs[0].SetValue("99")
	m, cmd := m.submitForTest()
	if cmd != nil {
		t.Fatal("an out of range score must not be sent")
	}
	if m.errMsg != "Creativity: Score must be between 1 and 10" {
		t.Errorf("got %q", m.errMsg)
	}

	m.inputs[0].SetValue("")
	m, cmd = m.submitForTest()
	if cmd != nil || m.errMsg != "Give at least one category a score." {
		t.Errorf("an empty form should ask for a score, got %q", m.errMsg)
	}

	m.inputs[0].SetValue("8")
	m, cmd = m.submitForTest()
	if cmd == nil {
		t.Fatal("a valid score should be sent")
	}
	if len(m.pending) != 1 || m.pending[0] != 0 {
		t.Errorf("only the filled category should be sent, got %v", m.pending)
	}
}

func TestSubmitSendsEveryCategoryThenReturnsToTheList(t *testing.T) {
	m := NewJudge(nil, testData())
	m = send(m, "enter")
	next, _ := m.Update(myScoresMsg{submissionID: "sub_a"})
	m = next.(Judge)
	m.inputs[0].SetValue("8")
	m.inputs[1].SetValue("4")

	m, cmd := m.submitForTest()
	if cmd == nil || len(m.pending) != 2 {
		t.Fatalf("both categories should be pending, got %v", m.pending)
	}
	if !strings.Contains(m.View(), "Saving 1 of 2") {
		t.Errorf("the footer should show progress:\n%s", m.View())
	}

	next, cmd = m.Update(scoreSavedMsg{})
	m = next.(Judge)
	if cmd == nil || m.pendingAt != 1 {
		t.Fatal("the second category should follow the first")
	}

	next, _ = m.Update(scoreSavedMsg{})
	m = next.(Judge)
	if m.scoring || m.pending != nil {
		t.Error("the form closes once every category is saved")
	}
	if !m.scored["sub_a"] {
		t.Error("the submission is now marked scored")
	}
	if !strings.Contains(m.View(), "Saved 2 scores for Aardvark") {
		t.Errorf("the footer should confirm:\n%s", m.View())
	}
}

func TestBackendErrorsAreShownVerbatim(t *testing.T) {
	m := NewJudge(nil, testData())
	m = send(m, "enter")
	next, _ := m.Update(myScoresMsg{submissionID: "sub_a"})
	m = next.(Judge)
	m.inputs[0].SetValue("8")
	m, _ = m.submitForTest()

	next, _ = m.Update(scoreSavedMsg{err: &api.Error{Message: "Only approved judges and organizers can score submissions"}})
	m = next.(Judge)
	if m.pending != nil {
		t.Error("a failure stops the run")
	}
	if !strings.Contains(m.View(), "Only approved judges and organizers can score submissions") {
		t.Errorf("the backend message is shown as it came:\n%s", m.View())
	}
}

func TestFitsEightyByTwentyFour(t *testing.T) {
	m := NewJudge(nil, testData())
	views := []string{m.View()}

	scoringModel := send(m, "enter")
	next, _ := scoringModel.Update(myScoresMsg{submissionID: "sub_a"})
	views = append(views, next.(Judge).View())

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

// submitForTest runs the submit path and hands back the concrete model.
func (m Judge) submitForTest() (Judge, tea.Cmd) {
	model, cmd := m.submit()
	return model.(Judge), cmd
}
