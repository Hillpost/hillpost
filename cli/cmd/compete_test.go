package cmd

import (
	"reflect"
	"testing"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

func TestTeamRowsCountMembers(t *testing.T) {
	rows := teamRows([]api.Team{{ID: "t1", Name: "Otters", Members: []api.Member{{}, {}}}})
	want := [][]string{{"Otters", "2", "t1"}}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("teamRows() = %v, want %v", rows, want)
	}
	if memberCount(1) != "1 member" || memberCount(0) != "0 members" {
		t.Errorf("memberCount pluralises wrongly: %q, %q", memberCount(1), memberCount(0))
	}
}

