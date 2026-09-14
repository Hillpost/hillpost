package api

// Types used by the organizer commands. Timestamps are milliseconds since the
// Unix epoch, as Convex stores them.

// Category is one judging category, from categories:list.
type Category struct {
	ID          string `json:"_id"`
	HackathonID string `json:"hackathonId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MaxScore    Number `json:"maxScore"`
	Order       Number `json:"order"`
}

// Member is one hackathon membership, from members:listMembers. TeamID is empty
// for members who are not on a team.
type Member struct {
	ID          string `json:"_id"`
	HackathonID string `json:"hackathonId"`
	UserID      string `json:"userId"`
	UserName    string `json:"userName"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	TeamID      string `json:"teamId"`
	JoinedAt    Number `json:"joinedAt"`
}

// Team is one team, from teams:list.
type Team struct {
	ID   string `json:"_id"`
	Name string `json:"name"`
}

// Submission is one project submission, from submissions:list.
type Submission struct {
	ID              string   `json:"_id"`
	HackathonID     string   `json:"hackathonId"`
	TeamID          string   `json:"teamId"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	ProjectURL      string   `json:"projectUrl"`
	SubmittedAt     Number   `json:"submittedAt"`
	SubmissionCount Number   `json:"submissionCount"`
	JudgedBy        []string `json:"judgedBy"`
}
