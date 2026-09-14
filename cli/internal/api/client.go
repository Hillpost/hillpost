// Package api talks to the Hillpost Convex deployment over its HTTP API.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// DefaultBaseURL is the production Convex deployment.
const DefaultBaseURL = "https://frugal-weasel-98.convex.cloud"

// Client calls Convex queries and mutations. A non-empty Token is sent to every
// function as the cliToken argument, which is how the backend identifies the user.
type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

// New returns a Client for baseURL, falling back to DefaultBaseURL when empty.
func New(baseURL, token string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Token:   token,
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

// Query runs a Convex query, decoding its return value into out (which may be nil).
func (c *Client) Query(ctx context.Context, path string, args map[string]any, out any) error {
	return c.call(ctx, "/api/query", path, args, out)
}

// Mutate runs a Convex mutation, decoding its return value into out (which may be nil).
func (c *Client) Mutate(ctx context.Context, path string, args map[string]any, out any) error {
	return c.call(ctx, "/api/mutation", path, args, out)
}

func (c *Client) call(ctx context.Context, endpoint, path string, args map[string]any, out any) error {
	if args == nil {
		args = map[string]any{}
	}
	if c.Token != "" {
		args["cliToken"] = c.Token
	}

	body, err := json.Marshal(map[string]any{"path": path, "args": args, "format": "json"})
	if err != nil {
		return fmt.Errorf("encode %s arguments: %w", path, err)
	}

	url := c.BaseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach %s (set HILLPOST_API_URL to use another deployment): %w", c.BaseURL, err)
	}
	defer resp.Body.Close()

	var payload struct {
		Status       string          `json:"status"`
		Value        json.RawMessage `json:"value"`
		ErrorMessage string          `json:"errorMessage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return fmt.Errorf("unexpected response from %s (HTTP %d)", url, resp.StatusCode)
	}

	switch payload.Status {
	case "error":
		return &Error{Message: strings.TrimSpace(payload.ErrorMessage)}
	case "success":
	default:
		return fmt.Errorf("unexpected response from %s (HTTP %d)", url, resp.StatusCode)
	}

	if out == nil || len(payload.Value) == 0 {
		return nil
	}
	if err := json.Unmarshal(payload.Value, out); err != nil {
		return fmt.Errorf("decode %s result: %w", path, err)
	}
	return nil
}
