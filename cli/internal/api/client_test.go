package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type request struct {
	Path   string         `json:"path"`
	Args   map[string]any `json:"args"`
	Format string         `json:"format"`
}

func capture(t *testing.T, response string) (*Client, *request, *string) {
	t.Helper()
	var got request
	var endpoint string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		endpoint = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(body, &got); err != nil {
			t.Errorf("request body is not JSON: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, response)
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL, ""), &got, &endpoint
}

func TestQueryDecodesValue(t *testing.T) {
	c, got, endpoint := capture(t, `{"status":"success","value":[{"_id":"h1","name":"Hacktober","myRole":"organizer"}]}`)

	var hackathons []Hackathon
	if err := c.Query(context.Background(), "hackathons:listMine", nil, &hackathons); err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(hackathons) != 1 || hackathons[0].Name != "Hacktober" || hackathons[0].MyRole != "organizer" {
		t.Fatalf("decoded %+v", hackathons)
	}
	if *endpoint != "/api/query" {
		t.Errorf("endpoint = %q", *endpoint)
	}
	if got.Path != "hackathons:listMine" || got.Format != "json" {
		t.Errorf("request = %+v", got)
	}
	if _, ok := got.Args["cliToken"]; ok {
		t.Errorf("cliToken sent without a token: %+v", got.Args)
	}
}

func TestMutateInjectsToken(t *testing.T) {
	c, got, endpoint := capture(t, `{"status":"success","value":{"hackathonId":"h1","alreadyMember":false}}`)
	c.Token = "hp_secret"

	var result JoinResult
	if err := c.Mutate(context.Background(), "hackathons:join", map[string]any{"joinCode": "ABC123"}, &result); err != nil {
		t.Fatalf("Mutate: %v", err)
	}
	if result.HackathonID != "h1" || result.AlreadyMember {
		t.Fatalf("decoded %+v", result)
	}
	if *endpoint != "/api/mutation" {
		t.Errorf("endpoint = %q", *endpoint)
	}
	if got.Args["cliToken"] != "hp_secret" || got.Args["joinCode"] != "ABC123" {
		t.Errorf("args = %+v", got.Args)
	}
}

func TestConvexErrorIsReturnedVerbatim(t *testing.T) {
	c, _, _ := capture(t, `{"status":"error","errorMessage":"Invalid join code"}`)

	err := c.Query(context.Background(), "hackathons:getByJoinCode", map[string]any{"joinCode": "nope"}, nil)
	var convexErr *Error
	if !errors.As(err, &convexErr) {
		t.Fatalf("want *api.Error, got %v", err)
	}
	if convexErr.Message != "Invalid join code" {
		t.Errorf("message = %q", convexErr.Message)
	}
}

func TestUnreachableDeploymentMentionsEnvVar(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := srv.URL
	srv.Close()

	err := New(url, "").Query(context.Background(), "cli:whoami", nil, nil)
	if err == nil {
		t.Fatal("want an error from a closed server")
	}
	if want := "HILLPOST_API_URL"; !strings.Contains(err.Error(), want) {
		t.Errorf("error %q does not mention %s", err, want)
	}
}

func TestNewDefaultsToProduction(t *testing.T) {
	if got := New("", "").BaseURL; got != DefaultBaseURL {
		t.Errorf("BaseURL = %q", got)
	}
	if got := New("https://example.com/", "").BaseURL; got != "https://example.com" {
		t.Errorf("BaseURL = %q", got)
	}
}
