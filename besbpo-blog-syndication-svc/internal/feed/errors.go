package feed

import "errors"

var (
	errMissingTenantID = errors.New("tenant id required")
	errTenantNotFound  = errors.New("tenant not found")
	errBuildingFeed    = errors.New("internal error building feed")
)
