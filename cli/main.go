// Command hillpost is the Hillpost hackathon CLI.
package main

import "github.com/Hillpost/hillpost/cli/cmd"

// version is overwritten at release time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	cmd.Version = version
	cmd.Execute()
}
