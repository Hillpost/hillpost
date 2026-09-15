// Package ui holds the CLI's shared palette and output helpers.
package ui

import "github.com/charmbracelet/lipgloss"

// Green is the Hillpost brand colour, the same one the site uses.
const Green = lipgloss.Color("#00FF41")

// The palette. Everything the CLI prints uses one of these.
var (
	Title   = lipgloss.NewStyle().Bold(true).Foreground(Green)
	Header  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("245"))
	Label   = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	Value   = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	Accent  = lipgloss.NewStyle().Foreground(Green)
	Success = lipgloss.NewStyle().Foreground(Green)
	Warn    = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
	Danger  = lipgloss.NewStyle().Foreground(lipgloss.Color("204"))
	Code    = lipgloss.NewStyle().Bold(true).Foreground(Green)
)

// Wordmark is the Hillpost logo as it appears on the site: a prompt glyph and
// the name. Render it with Title.
const Wordmark = ">_ HILLPOST"
