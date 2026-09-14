package api

import "encoding/json"

// Timestamps are milliseconds since the Unix epoch, as Convex stores them.

// Num is a whole number from Convex. Every Convex number is a JavaScript
// double, so the JSON format spells 1 as "1.0", which the standard decoder
// refuses to put in an int. Num accepts either spelling. Use it for every
// integer field that comes back from the backend.
type Num int64

// UnmarshalJSON decodes a JSON number, float-spelled or not.
func (n *Num) UnmarshalJSON(data []byte) error {
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	*n = Num(f)
	return nil
}

// Int returns the number for the many standard library calls that want an int.
func (n Num) Int() int { return int(n) }

// Hackathon is the shape returned by hackathons:get, listMine, listPublic and
// getByJoinCode. Join codes are only present for organizers and competitors;
// MyRole is only set by listMine and Role only by getByJoinCode.
type Hackathon struct {
	ID                         string  `json:"_id"`
	CreationTime               float64 `json:"_creationTime"`
	Name                       string  `json:"name"`
	Description                string  `json:"description"`
	OrganizerID                string  `json:"organizerId"`
	StartDate                  Num     `json:"startDate"`
	SubmissionsStartDate       *Num    `json:"submissionsStartDate"`
	SubmissionsEndDate         *Num    `json:"submissionsEndDate"`
	EndDate                    Num     `json:"endDate"`
	SubmissionFrequencyMinutes Num     `json:"submissionFrequencyMinutes"`
	IsActive                   bool    `json:"isActive"`
	IsPublic                   bool    `json:"isPublic"`
	CompetitorJoinCode         string  `json:"competitorJoinCode"`
	JudgeJoinCode              string  `json:"judgeJoinCode"`
	CreatedAt                  Num     `json:"createdAt"`
	MyRole                     string  `json:"myRole"`
	Role                       string  `json:"role"`
}

// Membership is one entry of cli:whoami's memberships list.
type Membership struct {
	HackathonID string `json:"hackathonId"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	IsActive    bool   `json:"isActive"`
}

// WhoAmI is the return value of cli:whoami.
type WhoAmI struct {
	UserID      string       `json:"userId"`
	UserName    string       `json:"userName"`
	Memberships []Membership `json:"memberships"`
}

// DeviceLogin is the return value of cli:startDeviceLogin. Interval is in seconds.
type DeviceLogin struct {
	DeviceCode      string `json:"deviceCode"`
	UserCode        string `json:"userCode"`
	VerificationURL string `json:"verificationUrl"`
	ExpiresAt       Num    `json:"expiresAt"`
	Interval        Num    `json:"interval"`
}

// DeviceClaim is the return value of cli:claimDevice. Status is "pending",
// "expired" or "approved"; Token and UserName are only set when approved.
type DeviceClaim struct {
	Status   string `json:"status"`
	Token    string `json:"token"`
	UserName string `json:"userName"`
}

// JoinResult is the return value of hackathons:join and hackathons:joinPublic.
type JoinResult struct {
	HackathonID   string `json:"hackathonId"`
	AlreadyMember bool   `json:"alreadyMember"`
}

// Member is one hackathonMembers row, as teams:list and teams:getMyTeam return
// it alongside a team.
type Member struct {
	ID       string `json:"_id"`
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
	Role     string `json:"role"`
	TeamID   string `json:"teamId"`
	Status   string `json:"status"`
	JoinedAt Num    `json:"joinedAt"`
}

// Team is the shape returned by teams:list, teams:get and teams:getMyTeam.
type Team struct {
	ID           string   `json:"_id"`
	CreationTime float64  `json:"_creationTime"`
	HackathonID  string   `json:"hackathonId"`
	Name         string   `json:"name"`
	CreatedAt    Num      `json:"createdAt"`
	Members      []Member `json:"members"`
}

// ChangelogEntry is one "what is new" note attached to a resubmission.
type ChangelogEntry struct {
	SubmissionCount Num    `json:"submissionCount"`
	WhatsNew        string `json:"whatsNew"`
	SubmittedAt     Num    `json:"submittedAt"`
}

// Submission is the shape returned by submissions:get, list, listForTeam and
// getLatestForTeam. SubmittedBy and JudgedBy are blanked for callers who may
// not see them.
type Submission struct {
	ID              string           `json:"_id"`
	HackathonID     string           `json:"hackathonId"`
	TeamID          string           `json:"teamId"`
	Name            string           `json:"name"`
	Description     string           `json:"description"`
	ProjectURL      string           `json:"projectUrl"`
	DemoURL         string           `json:"demoUrl"`
	DeployedURL     string           `json:"deployedUrl"`
	WhatsNew        string           `json:"whatsNew"`
	Changelog       []ChangelogEntry `json:"changelog"`
	SubmittedAt     Num              `json:"submittedAt"`
	SubmittedBy     string           `json:"submittedBy"`
	SubmissionCount Num              `json:"submissionCount"`
	JudgedBy        []string         `json:"judgedBy"`
}

// CategoryScore is one category's average inside a leaderboard entry.
type CategoryScore struct {
	CategoryID   string  `json:"categoryId"`
	CategoryName string  `json:"categoryName"`
	MaxScore     float64 `json:"maxScore"`
	AverageScore float64 `json:"averageScore"`
	JudgeCount   Num     `json:"judgeCount"`
}

// LeaderboardEntry is one ranked team. LatestSubmission is nil for a team that
// has not submitted yet.
type LeaderboardEntry struct {
	Rank             Num             `json:"rank"`
	TeamID           string          `json:"teamId"`
	TeamName         string          `json:"teamName"`
	LatestSubmission *Submission     `json:"latestSubmission"`
	AverageScore     float64         `json:"averageScore"`
	OverallScore     float64         `json:"overallScore"`
	CategoryScores   []CategoryScore `json:"categoryScores"`
	TotalJudgeCount  Num             `json:"totalJudgeCount"`
}

// Leaderboard is the return value of leaderboard:get. LeaderboardHidden is set
// when the organizer has hidden scores from the caller.
type Leaderboard struct {
	Entries           []LeaderboardEntry `json:"entries"`
	MaxPossibleScore  float64            `json:"maxPossibleScore"`
	LeaderboardHidden bool               `json:"leaderboardHidden"`
}

// FeedbackCategory names one scoring category in a feedback report.
type FeedbackCategory struct {
	ID       string  `json:"_id"`
	Name     string  `json:"name"`
	MaxScore float64 `json:"maxScore"`
}

// JudgeCategoryScore is one judge's score for one category. Score and Feedback
// are nil when that judge did not score that category.
type JudgeCategoryScore struct {
	CategoryID string   `json:"categoryId"`
	Score      *float64 `json:"score"`
	Feedback   *string  `json:"feedback"`
}

// FeedbackJudge is one judge's scores within an iteration. Label is a real name
// for organizers and "Judge N" for everyone else.
type FeedbackJudge struct {
	Label          string               `json:"label"`
	CategoryScores []JudgeCategoryScore `json:"categoryScores"`
}

// FeedbackIteration holds every judge's scores for one submission iteration.
type FeedbackIteration struct {
	SubmissionCount Num             `json:"submissionCount"`
	Judges          []FeedbackJudge `json:"judges"`
}

// Feedback is the return value of scores:getFeedbackForSubmission.
// FeedbackHidden is set when the organizer has not released feedback.
type Feedback struct {
	FeedbackHidden         bool                `json:"feedbackHidden"`
	CurrentSubmissionCount Num                 `json:"currentSubmissionCount"`
	Categories             []FeedbackCategory  `json:"categories"`
	Iterations             []FeedbackIteration `json:"iterations"`
}
