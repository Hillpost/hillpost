package api

import (
	"encoding/json"
	"fmt"
	"math"
)

// Number is a whole-number Convex field: a timestamp in milliseconds, a count,
// a score. Convex stores every v.number() as a float and its JSON format writes
// them with a decimal point ("createdAt": 1789428323350.0), which plain int64
// cannot decode, so decode through float64 and round.
type Number int64

func (n *Number) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*n = 0
		return nil
	}
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return fmt.Errorf("not a whole number: %s", data)
	}
	*n = Number(math.Round(f))
	return nil
}

func (n Number) MarshalJSON() ([]byte, error) { return json.Marshal(int64(n)) }
