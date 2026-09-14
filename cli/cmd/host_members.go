package cmd

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var memberFlags struct {
	role   string
	status string
}

var hostMembersCmd = &cobra.Command{
	Use:   "members",
	Short: "People in the current hackathon",
}

var membersListCmd = &cobra.Command{
	Use:   "list",
	Short: "List members, optionally filtered by role or status",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		id, err := hostHackathonID(cfg)
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		// Decode twice: once to filter, once to keep the backend's own JSON for --json.
		var raws []json.RawMessage
		if err := c.Query(ctx, "members:listMembers", map[string]any{"hackathonId": id}, &raws); err != nil {
			return err
		}
		if raws == nil {
			return errors.New("Only organizers can see the member list")
		}
		members := make([]api.Member, 0, len(raws))
		kept := make([]json.RawMessage, 0, len(raws))
		for _, raw := range raws {
			var m api.Member
			if err := json.Unmarshal(raw, &m); err != nil {
				return err
			}
			if memberFlags.role != "" && m.Role != memberFlags.role {
				continue
			}
			if memberFlags.status != "" && m.Status != memberFlags.status {
				continue
			}
			members = append(members, m)
			kept = append(kept, raw)
		}

		if jsonOut {
			raw, err := json.Marshal(kept)
			if err != nil {
				return err
			}
			return ui.PrintJSON(raw)
		}
		if len(members) == 0 {
			fmt.Println(ui.Label.Render("No members match."))
			return nil
		}

		var teams []api.Team
		if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": id}, &teams); err != nil {
			return err
		}
		teamNames := make(map[string]string, len(teams))
		for _, t := range teams {
			teamNames[t.ID] = t.Name
		}

		rows := make([][]string, 0, len(members))
		for _, m := range members {
			rows = append(rows, []string{m.UserName, m.Role, m.Status, teamNames[m.TeamID], ui.Date(int64(m.JoinedAt)), m.ID})
		}
		fmt.Print(ui.Table([]string{"NAME", "ROLE", "STATUS", "TEAM", "JOINED", "ID"}, rows))
		return nil
	},
}

var membersApproveCmd = &cobra.Command{
	Use:   "approve <memberId>",
	Short: "Approve a pending member",
	Args:  cobra.ExactArgs(1),
	RunE:  func(cmd *cobra.Command, args []string) error { return setMemberStatus(cmd, args[0], "approved") },
}

var membersRejectCmd = &cobra.Command{
	Use:   "reject <memberId>",
	Short: "Reject a pending member",
	Args:  cobra.ExactArgs(1),
	RunE:  func(cmd *cobra.Command, args []string) error { return setMemberStatus(cmd, args[0], "rejected") },
}

var membersRemoveCmd = &cobra.Command{
	Use:   "remove <memberId>",
	Short: "Remove someone from the hackathon",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		if err := c.Mutate(cmd.Context(), "members:removeMember", map[string]any{"memberId": args[0]}, nil); err != nil {
			return err
		}
		if !jsonOut {
			fmt.Println(ui.Success.Render("Member removed"))
		}
		return nil
	},
}

var membersRoleCmd = &cobra.Command{
	Use:       "role <memberId> <organizer|judge|competitor>",
	Short:     "Change what someone can do",
	Args:      cobra.ExactArgs(2),
	ValidArgs: []string{"organizer", "judge", "competitor"},
	RunE: func(cmd *cobra.Command, args []string) error {
		switch args[1] {
		case "organizer", "judge", "competitor":
		default:
			return fmt.Errorf("role must be organizer, judge or competitor, got %q", args[1])
		}
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		var raw json.RawMessage
		err = c.Mutate(cmd.Context(), "members:updateRole", map[string]any{
			"memberId": args[0],
			"role":     args[1],
		}, &raw)
		if err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Now a " + args[1]))
		return nil
	},
}

func init() {
	membersListCmd.Flags().StringVar(&memberFlags.role, "role", "", "only organizer, judge or competitor")
	membersListCmd.Flags().StringVar(&memberFlags.status, "status", "", "only pending, approved or rejected")

	hostMembersCmd.AddCommand(membersListCmd, membersApproveCmd, membersRejectCmd, membersRemoveCmd, membersRoleCmd)
	hostCmd.AddCommand(hostMembersCmd)
}

func setMemberStatus(cmd *cobra.Command, memberID, status string) error {
	c, _, err := authedClient()
	if err != nil {
		return err
	}
	var raw json.RawMessage
	err = c.Mutate(cmd.Context(), "members:updateStatus", map[string]any{
		"memberId": memberID,
		"status":   status,
	}, &raw)
	if err != nil {
		return err
	}
	if jsonOut {
		return ui.PrintJSON(raw)
	}
	fmt.Println(ui.Success.Render("Member " + status))
	return nil
}
