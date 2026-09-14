package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// isolate points os.UserConfigDir at a temporary directory.
func isolate(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("AppData", dir)
	} else {
		t.Setenv("XDG_CONFIG_HOME", dir)
		t.Setenv("HOME", dir)
	}
	t.Setenv("HILLPOST_TOKEN", "")
	t.Setenv("HILLPOST_API_URL", "")
	return dir
}

func TestLoadMissingFileIsZero(t *testing.T) {
	isolate(t)

	c, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c != (Config{}) {
		t.Errorf("want zero Config, got %+v", c)
	}
}

func TestSaveThenLoad(t *testing.T) {
	dir := isolate(t)

	want := Config{Token: "hp_abc", HackathonID: "h1", HackathonName: "Hacktober"}
	if err := want.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	path, err := Path()
	if err != nil {
		t.Fatalf("Path: %v", err)
	}
	// macOS puts the config under $HOME/Library/Application Support, so only
	// check that the path stayed inside the temporary dir.
	if rel, err := filepath.Rel(dir, path); err != nil || strings.HasPrefix(rel, "..") {
		t.Errorf("config path %q is outside the temporary dir %q", path, dir)
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("Stat: %v", err)
		}
		if info.Mode().Perm() != 0o600 {
			t.Errorf("mode = %v, want 0600", info.Mode().Perm())
		}
	}

	got, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != want {
		t.Errorf("loaded %+v, want %+v", got, want)
	}
}

func TestEnvOverridesFile(t *testing.T) {
	isolate(t)

	stored := Config{Token: "hp_file", APIURL: "https://file.convex.cloud"}
	if err := stored.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	c, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.EffectiveToken() != "hp_file" || c.EffectiveAPIURL() != "https://file.convex.cloud" {
		t.Fatalf("without env: %q %q", c.EffectiveToken(), c.EffectiveAPIURL())
	}

	t.Setenv("HILLPOST_TOKEN", "hp_env")
	t.Setenv("HILLPOST_API_URL", "https://env.convex.cloud")
	if got := c.EffectiveToken(); got != "hp_env" {
		t.Errorf("EffectiveToken = %q", got)
	}
	if got := c.EffectiveAPIURL(); got != "https://env.convex.cloud" {
		t.Errorf("EffectiveAPIURL = %q", got)
	}
	if c.Token != "hp_file" {
		t.Errorf("env leaked into the stored value: %q", c.Token)
	}
}
