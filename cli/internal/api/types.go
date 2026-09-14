package api

// Timestamps are milliseconds since the Unix epoch, as Convex stores them.

// Hackathon is the shape returned by hackathons:get, listMine, listPublic and
// getByJoinCode. Join codes are only present for organizers and competitors;
// MyRole is only set by listMine and Role only by getByJoinCode.
type Hackathon struct {
	ID                         string  `json:"_id"`
	CreationTime               float64 `json:"_creationTime"`
	Name                       string  `json:"name"`
	Description                string  `json:"description"`
	OrganizerID                string  `json:"organizerId"`
	StartDate                  Number  `json:"startDate"`
	SubmissionsStartDate       *Number `json:"submissionsStartDate"`
	SubmissionsEndDate         *Number `json:"submissionsEndDate"`
	EndDate                    Number  `json:"endDate"`
	SubmissionFrequencyMinutes Number  `json:"submissionFrequencyMinutes"`
	IsActive                   bool    `json:"isActive"`
	IsPublic                   bool    `json:"isPublic"`
	CompetitorJoinCode         string  `json:"competitorJoinCode"`
	JudgeJoinCode              string  `json:"judgeJoinCode"`
	CreatedAt                  Number  `json:"createdAt"`
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
	ExpiresAt       Number `json:"expiresAt"`
	Interval        Number `json:"interval"`
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
