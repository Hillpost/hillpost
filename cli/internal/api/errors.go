package api

// Error is an error returned by a Convex function. Its message is written by
// the backend and is shown to the user verbatim.
type Error struct {
	Message string
}

func (e *Error) Error() string { return e.Message }
