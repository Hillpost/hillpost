package flow

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

// Joined is the result of joining a hackathon: the hackathon itself, so the
// caller can name it, and what the backend did.
type Joined struct {
	Hackathon     api.Hackathon
	AlreadyMember bool
	Role          string          // "competitor" or "judge"
	Raw           json.RawMessage // the mutation's own JSON, for --json
}

// Join joins a hackathon with a competitor or judge invite code.
func Join(ctx context.Context, c *api.Client, code string) (Joined, error) {
	return join(ctx, c,
		"hackathons:getByJoinCode", map[string]any{"joinCode": code},
		"hackathons:join", map[string]any{"joinCode": code},
		code)
}

// JoinPublic joins a public hackathon by id, with no code.
func JoinPublic(ctx context.Context, c *api.Client, hackathonID string) (Joined, error) {
	return join(ctx, c,
		"hackathons:get", map[string]any{"hackathonId": hackathonID},
		"hackathons:joinPublic", map[string]any{"hackathonId": hackathonID},
		hackathonID)
}

// join looks the hackathon up before joining it: the join mutation returns only
// an id, and the lookup is also what says whether this is a judge code.
func join(ctx context.Context, c *api.Client, lookupPath string, lookupArgs map[string]any, joinPath string, joinArgs map[string]any, what string) (Joined, error) {
	var found *api.Hackathon
	if err := c.Query(ctx, lookupPath, lookupArgs, &found); err != nil {
		return Joined{}, err
	}
	if found == nil {
		return Joined{}, fmt.Errorf("no hackathon found for %q", what)
	}

	var raw json.RawMessage
	if err := c.Mutate(ctx, joinPath, joinArgs, &raw); err != nil {
		return Joined{}, err
	}
	var result api.JoinResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return Joined{}, err
	}

	// getByJoinCode is the only lookup that knows which code was used; a public
	// hackathon is always joined as a competitor.
	role := found.Role
	if role == "" {
		role = "competitor"
	}
	found.ID = result.HackathonID
	return Joined{Hackathon: *found, AlreadyMember: result.AlreadyMember, Role: role, Raw: raw}, nil
}
