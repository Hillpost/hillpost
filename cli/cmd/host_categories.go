package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var categoryFlags struct {
	description string
	max         int
	name        string
}

var hostCategoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "Judging categories for the current hackathon",
}

var categoriesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List the judging categories",
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
		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "categories:list", map[string]any{"hackathonId": id}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		var categories []api.Category
		if err := json.Unmarshal(raw, &categories); err != nil {
			return err
		}
		if len(categories) == 0 {
			fmt.Println(ui.Label.Render("No categories yet. Add one: hillpost host categories add <name> --max 10"))
			return nil
		}
		rows := make([][]string, 0, len(categories))
		for _, cat := range categories {
			rows = append(rows, []string{cat.Name, strconv.FormatInt(int64(cat.MaxScore), 10), cat.Description, cat.ID})
		}
		fmt.Print(ui.Table([]string{"NAME", "MAX", "DESCRIPTION", "ID"}, rows))
		return nil
	},
}

var categoriesAddCmd = &cobra.Command{
	Use:   "add <name>",
	Short: "Add a judging category",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		id, err := hostHackathonID(cfg)
		if err != nil {
			return err
		}
		if categoryFlags.max <= 0 {
			return errors.New("--max must be a positive score")
		}
		var raw json.RawMessage
		err = c.Mutate(cmd.Context(), "categories:create", map[string]any{
			"hackathonId": id,
			"name":        args[0],
			"description": categoryFlags.description,
			"maxScore":    categoryFlags.max,
		}, &raw)
		if err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Added " + args[0]))
		return nil
	},
}

var categoriesEditCmd = &cobra.Command{
	Use:   "edit <categoryId>",
	Short: "Change a category's name, description or maximum score",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		mutArgs := map[string]any{"categoryId": args[0]}
		flags := cmd.Flags()
		if flags.Changed("name") {
			mutArgs["name"] = categoryFlags.name
		}
		if flags.Changed("description") {
			mutArgs["description"] = categoryFlags.description
		}
		if flags.Changed("max") {
			mutArgs["maxScore"] = categoryFlags.max
		}
		if len(mutArgs) == 1 {
			return errors.New("nothing to change, pass --name, --description or --max")
		}
		var raw json.RawMessage
		if err := c.Mutate(cmd.Context(), "categories:update", mutArgs, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Category updated"))
		return nil
	},
}

var categoriesRemoveCmd = &cobra.Command{
	Use:   "remove <categoryId>",
	Short: "Delete a category",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		if err := c.Mutate(cmd.Context(), "categories:remove", map[string]any{"categoryId": args[0]}, nil); err != nil {
			return err
		}
		if !jsonOut {
			fmt.Println(ui.Success.Render("Category removed"))
		}
		return nil
	},
}

func init() {
	categoriesAddCmd.Flags().StringVar(&categoryFlags.description, "description", "", "what judges should look for")
	categoriesAddCmd.Flags().IntVar(&categoryFlags.max, "max", 10, "highest score a judge can give")

	categoriesEditCmd.Flags().StringVar(&categoryFlags.name, "name", "", "rename the category")
	categoriesEditCmd.Flags().StringVar(&categoryFlags.description, "description", "", "replace the description")
	categoriesEditCmd.Flags().IntVar(&categoryFlags.max, "max", 10, "highest score a judge can give")

	hostCategoriesCmd.AddCommand(categoriesListCmd, categoriesAddCmd, categoriesEditCmd, categoriesRemoveCmd)
	hostCmd.AddCommand(hostCategoriesCmd)
}
