package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Table renders rows under headers, every column padded to its widest cell.
// Rows shorter than headers are padded with empty cells.
func Table(headers []string, rows [][]string) string {
	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = lipgloss.Width(h)
	}
	for _, row := range rows {
		for i, cell := range row {
			if i < len(widths) && lipgloss.Width(cell) > widths[i] {
				widths[i] = lipgloss.Width(cell)
			}
		}
	}

	var b strings.Builder
	line := func(cells []string, style lipgloss.Style) {
		parts := make([]string, len(headers))
		for i := range headers {
			cell := ""
			if i < len(cells) {
				cell = cells[i]
			}
			parts[i] = style.Render(cell + strings.Repeat(" ", widths[i]-lipgloss.Width(cell)))
		}
		b.WriteString(strings.TrimRight(strings.Join(parts, "  "), " "))
		b.WriteString("\n")
	}

	line(headers, Header)
	for _, row := range rows {
		line(row, Value)
	}
	return b.String()
}
