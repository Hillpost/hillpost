package api

// Category is one judging category, from categories:list.
type Category struct {
	ID          string `json:"_id"`
	HackathonID string `json:"hackathonId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MaxScore    Num    `json:"maxScore"`
	Order       Num    `json:"order"`
}
