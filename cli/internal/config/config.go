// Package config stores the CLI's token and current hackathon on disk.
package config

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// Config is the on-disk file. Environment variables override two of its fields
// at read time; see EffectiveToken and EffectiveAPIURL.
type Config struct {
	Token         string `json:"token,omitempty"`
	APIURL        string `json:"api_url,omitempty"`
	HackathonID   string `json:"hackathon_id,omitempty"`
	HackathonName string `json:"hackathon_name,omitempty"`
}

// Path is the config file location: %AppData%\hillpost\config.json on Windows,
// ~/.config/hillpost/config.json elsewhere.
func Path() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "hillpost", "config.json"), nil
}

// Load reads the config file. A missing file is not an error: it yields the
// zero Config.
func Load() (Config, error) {
	var c Config
	path, err := Path()
	if err != nil {
		return c, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return c, nil
	}
	if err != nil {
		return c, err
	}
	if err := json.Unmarshal(data, &c); err != nil {
		return Config{}, err
	}
	return c, nil
}

// Save writes the config file with mode 0600, creating its directory.
func (c Config) Save() error {
	path, err := Path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// EffectiveToken returns HILLPOST_TOKEN when set, otherwise the stored token.
func (c Config) EffectiveToken() string {
	if t := os.Getenv("HILLPOST_TOKEN"); t != "" {
		return t
	}
	return c.Token
}

// EffectiveAPIURL returns HILLPOST_API_URL when set, otherwise the stored URL
// (empty means the client's default deployment).
func (c Config) EffectiveAPIURL() string {
	if u := os.Getenv("HILLPOST_API_URL"); u != "" {
		return u
	}
	return c.APIURL
}
