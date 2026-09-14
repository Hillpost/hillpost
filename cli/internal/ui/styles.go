// Package ui holds the CLI's shared palette and output helpers.
package ui

import "github.com/charmbracelet/lipgloss"

// The palette. Everything the CLI prints uses one of these.
var (
	Title   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170"))
	Header  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("245"))
	Label   = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	Value   = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	Accent  = lipgloss.NewStyle().Foreground(lipgloss.Color("170"))
	Success = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
	Warn    = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
	Danger  = lipgloss.NewStyle().Foreground(lipgloss.Color("204"))
	Code    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170"))
)
