// Package flow holds the work behind each hillpost flow, so a cobra command and
// the dashboard can drive the same code. Nothing here prints or reads a
// terminal: it takes an api.Client, calls the backend and hands the result back.
package flow

import (
	"context"
	"errors"
	"time"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

// ErrLoginExpired is returned once a login code is too old to approve.
var ErrLoginExpired = errors.New("the login code expired, run hillpost login again")

// StartLogin asks the backend for a code the user approves in the browser.
func StartLogin(ctx context.Context, c *api.Client) (api.DeviceLogin, error) {
	var device api.DeviceLogin
	err := c.Mutate(ctx, "cli:startDeviceLogin", nil, &device)
	return device, err
}

// Claim asks once whether the device has been approved. A pending device is not
// an error: the returned Status is "pending", "approved" or "expired".
func Claim(ctx context.Context, c *api.Client, deviceCode string) (api.DeviceClaim, error) {
	var claim api.DeviceClaim
	err := c.Mutate(ctx, "cli:claimDevice", map[string]any{"deviceCode": deviceCode}, &claim)
	return claim, err
}

// PollInterval is how long to wait between Claim calls for this device.
func PollInterval(device api.DeviceLogin) time.Duration {
	if device.Interval <= 0 {
		return 2 * time.Second
	}
	return time.Duration(device.Interval) * time.Second
}

// WaitForApproval blocks until the user approves the device, the code expires
// or ctx ends. Callers that need to stay responsive should tick on Claim
// themselves instead.
func WaitForApproval(ctx context.Context, c *api.Client, device api.DeviceLogin) (api.DeviceClaim, error) {
	interval := PollInterval(device)
	for {
		select {
		case <-ctx.Done():
			return api.DeviceClaim{}, ctx.Err()
		case <-time.After(interval):
		}
		claim, err := Claim(ctx, c, device.DeviceCode)
		if err != nil {
			return api.DeviceClaim{}, err
		}
		switch claim.Status {
		case "approved":
			return claim, nil
		case "expired":
			return api.DeviceClaim{}, ErrLoginExpired
		}
	}
}

// WhoAmI reads the logged-in user and their hackathon memberships.
func WhoAmI(ctx context.Context, c *api.Client) (api.WhoAmI, error) {
	var me api.WhoAmI
	err := c.Query(ctx, "cli:whoami", nil, &me)
	return me, err
}
