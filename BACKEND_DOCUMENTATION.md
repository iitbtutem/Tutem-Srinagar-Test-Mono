# Project Backend Documentation

## Overview

This project uses a Convex backend located in `packages/api/convex`. The backend supports a ride-hailing style workflow with rider and driver profiles, organization-specific vehicle and license requirements, organization fare rates, ride requests, ride lifecycle transitions, ratings, OTP authentication, file uploads through S3-compatible storage, push notifications, Ably presence-based driver discovery, and Google Maps route/geocoding calls.

Generated Convex bindings are exported from `packages/api/index.js` and `packages/api/index.d.ts`. The repository README notes that app code should import from `@tutem/api` instead of importing `convex/_generated` directly.

## Backend Structure

| Path | Purpose |
|---|---|
| `packages/api/convex/schema.ts` | Convex database schema and indexes. |
| `packages/api/convex/routes/*.ts` | Public queries/mutations plus internal queries/mutations grouped by domain. |
| `packages/api/convex/actions/*.ts` | Node actions for OTP/SMS, ride side effects, S3 presigned uploads, and Ably-based nearby-driver discovery. |
| `packages/api/convex/helpers/sessionFunctions.ts` | Custom authenticated query/mutation wrappers and action session validation. |
| `packages/api/convex/helpers/maps.ts` | Google Maps Directions and Geocoding helpers plus geometry helpers. |
| `packages/api/convex/helpers/pushNotifications.ts` | Expo push notification helpers. |
| `packages/api/convex/s3.ts` | S3-compatible client configured with MinIO environment variables. |
| `packages/api/convex/CONSTANTS.ts` | Enumerations and timing constants. |

Convex documents always include Convex-managed `_id` and `_creationTime` fields even when not listed in table schemas below.

## Shared Constants

| Constant | Value | Used for |
|---|---|---|
| `GENDER` | `Male`, `Female`, `Other` | User gender values. |
| `VEHICLE_TYPE` | `Bike`, `Car`, `Truck`, `SUV`, `Van` | Vehicle type values. |
| `FUEL_TYPE` | `Petrol`, `Diesel`, `EV` | Vehicle fuel type values. |
| `VEHICLE_CLASS` | `Bike`, `Auto`, `Cab` | Fare class and driver-filter values. |
| `PERMISSIONS` | `Driver`, `Rider`, `Admin` | User permission values. |
| `RIDE_OTP_SIZE` | `4` | Ride-start OTP length. |
| `OTP_SIZE` | `6` | Login OTP length. |
| `OTP_ATTEMPTS` and `MAX_ATTEMPTS` | `5` | OTP verification attempt limits. |
| `OTP_EXPIRY_MS` | `5` | Used as minutes in code via `OTP_EXPIRY_MS * 1000 * 60`. Name is misleading. |
| `TWENTY_FOUR_HOURS` | `24 * 60 * 60 * 1000` | Rating edit/delete window. |
| `METERS_IN_KM` | `1000` | Fare calculations. |

## Database Schema

### Table: `user`

Purpose: Stores shared profile and identity data for people who can become riders, drivers, or both.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `firstName` | `string` | Yes | None | User first name. | None |
| `lastName` | `string` | No | None | User last name. | None |
| `dob` | `string` | Yes | None | Date of birth string. Exact format is not validated in the backend. | None |
| `profilePictureKey` | `string` | No | None | Object-storage key for the profile image. Several queries replace this with a signed URL in returned objects. | MinIO/S3 object key |
| `gender` | `Male`, `Female`, or `Other` | Yes | None | Used for rider/driver gender matching. | None |
| `phoneNumber` | `string` | Yes | None | Phone number used for lookup and OTP session creation. | Referenced by auth flow |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_phoneNumber` | `phoneNumber` | Finds existing users during OTP verification and rider/driver registration. |

Usage notes:

- Inserted by `routes.rider.addRider` and `routes.driver.addDriver` when no user exists for the phone number.
- Read by auth, rider, driver, ride, and rating queries.
- `phoneNumber` uniqueness is enforced only in application code by checking the index before inserting.

### Table: `rider`

Purpose: Stores rider-specific profile state linked to a `user`.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `isVerified` | `Pending`, `Rejected`, or `Verified` | Yes | Usually `"Pending"` | Rider verification status. No verification workflow is present in the inspected code. | None |
| `userId` | `Id<"user">` | Yes | None | Owning user document. | References `user._id` |
| `expoPushToken` | `string` | No | None | Expo push token for rider notifications. | Expo push service |
| `genderMatching` | `boolean` | Yes | Usually `false` | Rider preference for same-gender matching. | Compared against driver user's gender |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_user` | `userId` | Finds a rider profile for the authenticated user. |

Usage notes:

- Created by `routes.rider.addRider` and `routes.rider.registerAsRider`.
- Used throughout ride booking and ride display flows.

### Table: `driver`

Purpose: Stores driver-specific profile, license, online/availability state, organization membership, and notification data.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `licenseNumber` | `string` | Yes | None | Driver license number. | None |
| `licenseImageFrontKey` | `string` | No | None | Object-storage key for front license image. | MinIO/S3 object key |
| `licenseImageBackKey` | `string` | No | None | Object-storage key for back license image. | MinIO/S3 object key |
| `paymentQrCodeKey` | `string` | No | None | Object-storage key for payment QR image. | MinIO/S3 object key |
| `isLicenseVerified` | `Pending`, `Rejected`, or `Verified` | Yes | Derived from organization settings | License verification state. | Controlled by organization requirements |
| `isOnline` | `boolean` | Yes | Usually `true` on creation | Whether the driver is online. | Used by discovery and availability toggles |
| `isAvailableForRide` | `boolean` | Yes | Usually `true` on creation | Whether driver can receive or accept rides. | Mutated by ride lifecycle |
| `organizationId` | `Id<"organization">` | Yes | None | Driver's organization. | References `organization._id` |
| `userId` | `Id<"user">` | Yes | None | Owning user document. | References `user._id` |
| `expoPushToken` | `string` | No | None | Expo push token for driver notifications. | Expo push service |
| `genderMatching` | `boolean` | Yes | Usually `false` | Driver preference for same-gender rider matching. | Compared against rider user's gender |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_user` | `userId` | Finds a driver profile for the authenticated user. |
| `by_organizition` | `organizationId` | Finds drivers by organization. Note the index name typo is part of the schema. |

Usage notes:

- Created by `routes.driver.addDriver` and `routes.driver.registerAsDriver`.
- `isAvailableForRide` is set to `false` after accepting a ride and `true` after cancellation, abort, or completion.
- Several image key fields are returned as temporary signed URLs by queries.

### Table: `organization`

Purpose: Defines operating organizations, driver/vehicle verification policy, edit policy, and optional service-area geometry.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `name` | `string` | Yes | None | Organization name. | None |
| `address` | `string` | Yes | None | Organization address. | None |
| `isLicenseVerficationRequired` | `boolean` | Yes | None | Whether license images/verification are required. Name typo is part of schema. | Used by driver mutations |
| `isVehicleRCVerificationRequired` | `boolean` | Yes | None | Whether vehicle RC image and verification are required. | Used by vehicle mutations |
| `isVehicleInsuranceImageRequired` | `boolean` | Yes | None | Whether insurance image is required. | Used by vehicle mutations |
| `canDriverEditLicesnse` | `boolean` | Yes | None | Whether driver can edit license details. Name typo is part of schema. | Used by driver mutations |
| `canDriverEditVehicle` | `boolean` | Yes | None | Whether driver can edit vehicle details. | Used by vehicle mutations |
| `polygon` | `Array<{ latitude: number, longitude: number }>` | No | None | Optional service-area polygon. | Used by nearby-organization query |
| `boundingBox` | Object with `north`, `south`, `east`, `west` coordinate objects | No | None | Optional precomputed box used before polygon filtering. | Used by nearby-organization query |

Indexes: None.

Usage notes:

- CRUD mutations exist for organizations.
- Drivers reference organizations.
- Organization rates reference organizations and drive fare calculation.
- No backend mutation currently writes `polygon` or `boundingBox`.

### Table: `organizationsRate`

Purpose: Stores organization fare configuration by vehicle class.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `vehicleClass` | `Bike`, `Auto`, or `Cab` | Yes | None | Vehicle class the rate applies to. | Matches `vehicle.class` |
| `baseDistance` | `number` | Yes | None | Base included distance, treated as meters by fare actions. | None |
| `baseDistanceRate` | `number` | Yes | None | Base fare for base distance. | None |
| `ratePerKm` | `number` | Yes | None | Incremental fare rate per kilometer. | None |
| `waitingPerMinute` | `number` | Yes | None | Waiting-rate field. Not used in inspected fare calculations. | None |
| `organizationId` | `Id<"organization">` | Yes | None | Organization that owns the rate. | References `organization._id` |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_organization` | `organizationId` | Fetches rates for an organization and filters by vehicle class. |

Usage notes:

- Used in nearby-driver fare estimates and ride cancellation/completion fare recalculation.
- Code does not enforce one rate per organization per vehicle class.

### Table: `vehicle`

Purpose: Stores a driver's registered vehicle and verification state.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `isVerified` | `Pending`, `Rejected`, or `Verified` | Yes | Derived from organization settings | Vehicle verification status. | Controlled by organization settings |
| `registrationNumber` | `string` | Yes | None | Vehicle registration number. | Application code checks uniqueness |
| `rcImageKey` | `string` | No | None | Object-storage key for RC image. | MinIO/S3 object key |
| `insuranceImageKey` | `string` | No | None | Object-storage key for insurance image. | MinIO/S3 object key |
| `model` | `string` | Yes | None | Vehicle model. | None |
| `type` | `Bike`, `Car`, `Truck`, `SUV`, or `Van` | Yes | None | Vehicle type. | None |
| `fuelType` | `Petrol`, `Diesel`, or `EV` | Yes | None | Fuel type. | None |
| `class` | `Bike`, `Auto`, or `Cab` | Yes | None | Ride/fare class. | Matches `organizationsRate.vehicleClass` |
| `color` | `string` | Yes | None | Vehicle color. | None |
| `seatingCapacity` | `number` | Yes | None | Seat count. | Validated as 2 through 50 in `addVehicle` |
| `ownerId` | `Id<"driver">` | Yes | None | Driver who owns the vehicle. | References `driver._id` |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_owner` | `ownerId` | Finds a driver's vehicle. |
| `by_registrationNumber` | `registrationNumber` | Checks duplicate vehicle registration. |

Usage notes:

- Code enforces one vehicle per driver in `addVehicle`.
- `updateVehicle` does not repeat the seating capacity range check from `addVehicle`.

### Table: `userPermission`

Purpose: Stores role-like permissions for users.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `permission` | `Driver`, `Rider`, or `Admin` | Yes | None | Permission assigned to the user. | None |
| `userId` | `Id<"user">` | Yes | None | User that receives the permission. | References `user._id` |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_user` | `userId` | Fetch permissions for a user. No inspected backend procedure reads this table. |

Usage notes:

- Inserted during rider and driver registration.
- `routes.driver.registerAsDriver` inserts permission `"Rider"` instead of `"Driver"` in the inspected code. Needs clarification.

### Table: `ride`

Purpose: Stores ride requests and lifecycle state.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `riderId` | `Id<"rider">` | Yes | None | Rider who requested the ride. | References `rider._id` |
| `driverId` | `Id<"driver">` | Yes | None | Driver currently assigned to the ride request. | References `driver._id` |
| `fare` | `number` | Yes | None | Current ride fare, initially estimated and later recalculated for abort/completion. | Uses organization rate |
| `hasReachedDestionation` | `boolean` | Yes | Usually `false` | Whether destination has been reached. Name typo is part of schema/API. | Set by `hasReachedDestination` |
| `status` | `Open`, `Active`, `Driver Arrived`, `Abort`, `Completed`, or `Canceled` | Yes | `"Open"` on booking | Ride lifecycle status. | None |
| `requestStatus` | `Pending`, `Accepted`, `Rejected`, or `No Response` | Yes | `"Pending"` on booking | Driver response state for the request. | None |
| `pickup` | `{ address: string, latitude: number, longitude: number }` | Yes | None | Pickup location. | None |
| `destination` | `{ address: string, latitude: number, longitude: number }` | Yes | None | Intended destination. | None |
| `dropOff` | `{ address: string, latitude: number, longitude: number }` | No | None | Actual drop-off/abort location when different or available. | Derived from Google Maps geocoding |
| `distance` | `number` | Yes | None | Ride distance in meters in fare code. | None |
| `expectedDuration` | `string` | No | None | Estimated duration text from caller. | None |
| `otp` | `number` | No | None | Ride-start OTP generated after arrival. Hidden in several driver-facing query responses. | None |
| `updatedAt` | `number` | Yes | `Date.now()` on writes | Last update timestamp in milliseconds. | None |
| `requestedAt` | `number` | Yes | `Date.now()` on booking | Request timestamp in milliseconds. | None |
| `acceptedAt` | `number` | No | None | Acceptance timestamp. | None |
| `arrivedAt` | `number` | No | None | Driver-arrived timestamp. | None |
| `startedAt` | `number` | No | None | Ride-start timestamp. | None |
| `completedAt` | `number` | No | None | Completion timestamp. | None |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_rider` | `riderId` | Finds rider current rides and history. |
| `by_driver` | `driverId` | Finds driver requests, current rides, and history. |

Usage notes:

- Ride flow is primarily orchestrated by actions in `actions/ride.ts`, which call internal mutations in `routes/rides.ts`.
- Booking schedules `markNoResponseInternal` after the configured driver response time.
- Active rides can be aborted by either party with fare recalculation.

### Table: `rideReasons`

Purpose: Stores cancellation or abort reasons for rides.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `rideId` | `Id<"ride">` | Yes | None | Ride the reason belongs to. | References `ride._id` |
| `driverId` | `Id<"driver">` | No | None | Driver who supplied the reason. Omitted for rider reasons. | References `driver._id` |
| `reason` | `string` | Yes | None | Human-entered reason text. | None |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_ride` | `rideId` | Fetches reasons for ride details. |

### Table: `ratings`

Purpose: Stores one rider-submitted and one driver-submitted rating per ride.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `rideId` | `Id<"ride">` | Yes | None | Rated ride. | References `ride._id` |
| `riderId` | `Id<"rider">` | Yes | None | Rider in the ride. | References `rider._id` |
| `driverId` | `Id<"driver">` | Yes | None | Driver in the ride. | References `driver._id` |
| `raterType` | `Rider` or `Driver` | Yes | None | Indicates who submitted the rating. | Used to infer rated party |
| `score` | `number` | Yes | None | Rating score. | Validated as 1 through 5 by rating mutations |
| `comment` | `string` | No | None | Optional rating comment. | None |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_ride` | `rideId` | Fetch ratings for one ride and enforce duplicate check by filter. |
| `by_rider` | `riderId` | Compute rider average from driver ratings. |
| `by_driver` | `driverId` | Compute driver average from rider ratings. |

Usage notes:

- `submitRating` prevents duplicate ratings by `rideId` plus `raterType`.
- `updateRating` and `deleteRating` require the provided rater id/type to match and are limited to 24 hours after creation.

### Table: `rideSettings`

Purpose: Stores global ride behavior configuration.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `nearbyRadius` | `number` | Yes | None | Driver discovery radius. Converted from meters to kilometers in Ably action. | Used by nearby-driver discovery |
| `arrivedDistance` | `number` | Yes | None | Distance threshold for arrival/completion/cancellation fare logic, treated as meters. | Used by ride actions |
| `driverResponseTime` | `number` | Yes | None | Driver response timeout. In `bookRideInternal` it is multiplied by `60 * 1000`; in `changeDriverInternal` by `1000`. Needs clarification. | Used by scheduler |
| `maxDriverRideRequests` | `number` | No | Defaults to `3` in nearby-driver filtering | Max pending ride requests a driver can have. | Used by discovery |
| `cancellationPenalty` | `number` | No | Defaults to `50` in rider cancellation actions | Penalty amount for rider active-ride cancellation before destination. | Used by fare calculation |

Indexes: None.

Usage notes:

- Queries throw `ConvexError("Ride settings not configured")` if no document exists.
- No inspected mutation creates or updates ride settings.

### Table: `otpSession`

Purpose: Temporary login OTP state keyed by phone number.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `phoneNumber` | `string` | Yes | None | Phone number OTP was sent to. | None |
| `hashedOtp` | `string` | Yes | None | SHA-256 hash of generated OTP. | None |
| `expiresAt` | `number` | Yes | `Date.now() + 5 minutes` | Expiration timestamp in milliseconds. | None |
| `attempts` | `number` | Yes | `0` | Incorrect attempt count. | None |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_phone` | `phoneNumber` | Upsert, lookup, delete, and increment OTP sessions. |

### Table: `session`

Purpose: Stores authenticated app sessions using random UUID tokens.

| Field | Type | Required | Default | Description | Relationship / Reference |
|---|---|---:|---|---|---|
| `sessionToken` | `string` | Yes | Random UUID generated by action | Token passed to authenticated queries, mutations, and actions. | None |
| `userId` | `Id<"user">` | Yes | None | Authenticated user. | References `user._id` |
| `phoneNumber` | `string` | Yes | None | Phone number associated with the session. | None |
| `expiresAt` | `number` | Yes | `Date.now() + 30 days` | Expiration timestamp in milliseconds. | None |

Indexes:

| Name | Fields | Purpose |
|---|---|---|
| `by_sessionToken` | `sessionToken` | Session validation and logout. |
| `by_phone` | `phoneNumber` | Lookup sessions by phone if needed. No inspected procedure uses it. |
| `by_userId` | `userId` | Lookup sessions by user if needed. No inspected procedure uses it. |

## Database Relationships

| Relationship | Cardinality / Behavior |
|---|---|
| `user` to `rider` | A user can have one rider profile by code convention. Enforced in mutations by checking `rider.by_user`; no unique database constraint exists. |
| `user` to `driver` | A user can have one driver profile by code convention. Enforced in mutations by checking `driver.by_user`; no unique database constraint exists. |
| `user` to `userPermission` | A user can have multiple permission rows. |
| `organization` to `driver` | One organization can have many drivers. |
| `organization` to `organizationsRate` | One organization can have many rate rows. Code expects matching rows by vehicle class during fare calculations. |
| `driver` to `vehicle` | Code enforces one vehicle per driver at `addVehicle` time. |
| `rider` and `driver` to `ride` | Each ride references one rider and one assigned driver. Histories are fetched by `ride.by_rider` and `ride.by_driver`. |
| `ride` to `rideReasons` | A ride can have multiple cancellation/abort reasons. Missing `driverId` means rider reason. |
| `ride`, `rider`, `driver` to `ratings` | A ride can have at most one rating per `raterType` by application check. |
| `session` to `user` | Session validates to one user. Expired sessions are rejected but not automatically deleted by validation. |

## Convex API Documentation

Procedure names below use their generated API path, for example `api.routes.rides.getRide`.

### Authentication Model

The backend does not use Convex Auth in the inspected code. It uses a custom `session` table.

- `authenticatedQuery` and `authenticatedMutation` add a required `sessionToken: string` argument, look up `session.by_sessionToken`, reject expired sessions, then load `ctx.user`.
- Actions call `validateSession(ctx, sessionToken)`, which delegates to internal auth queries and returns `{ session, user }`.
- Many public queries and mutations are not wrapped and instead accept IDs directly. Treat those as not session-protected unless app routing prevents misuse.

### Queries

| Procedure | File | Auth | Arguments | Returns | Reads | Notes |
|---|---|---|---|---|---|---|
| `routes.settings.rideSettings` | `packages/api/convex/routes/settings.ts` | Public | None | First `rideSettings` doc | `rideSettings` | Throws if settings are missing. |
| `routes.organizations.getAllOrganizations` | `packages/api/convex/routes/organizations.ts` | Public | None | `organization[]` | `organization` | Used by registration/admin-style flows. |
| `routes.organizations.getNearbyOrganization` | `packages/api/convex/routes/organizations.ts` | Public | `driverLocation: { latitude, longitude }` | `organization[]` | `organization` | Filters by optional bounding box and polygon; organizations without polygon are allowed. |
| `routes.organizations.getOrganizationById` | `packages/api/convex/routes/organizations.ts` | Public | `id: Id<"organization">` | Organization document or `null` | `organization` | Direct `db.get`. |
| `routes.organizations.getOrganizationRates` | `packages/api/convex/routes/organizations.ts` | Public | `organizationId` | `organizationsRate[]` | `organizationsRate` | Uses `by_organization`. |
| `routes.organizations.getOrganizationRateById` | `packages/api/convex/routes/organizations.ts` | Public | `id` | Organization-rate document or `null` | `organizationsRate` | Direct `db.get`. |
| `routes.organizations.getOrganizationRateByVehicleClass` | `packages/api/convex/routes/organizations.ts` | Public | `organizationId`, `vehicleClass` | First matching rate or `null` | `organizationsRate` | Filters within `by_organization`. |
| `routes.vehicle.getVehicleByDriverId` | `packages/api/convex/routes/vehicle.ts` | Public | `driverId` | Vehicle with signed `rcImageKey` and `insuranceImageKey`, or `null` | `vehicle` | Calls S3 presigner for image keys. |
| `routes.driver.getUser` | `packages/api/convex/routes/driver.ts` | Session | `sessionToken` | Authenticated user plus `driverDetails` | `session`, `user`, `driver`, `organization`, `ratings` | Returns signed profile/license URLs and driver average rating. |
| `routes.driver.getDriver` | `packages/api/convex/routes/driver.ts` | Public | `id: Id<"driver">` | Driver plus `userDetails` and signed image URLs | `driver`, `user` | Throws if driver missing. |
| `routes.driver.getDriverPaymentQrImage` | `packages/api/convex/routes/driver.ts` | Public | `driverId` | Signed QR URL or `null` | `driver` | Throws if driver missing. |
| `routes.rider.getRider` | `packages/api/convex/routes/rider.ts` | Session | `sessionToken` | Authenticated user plus `riderDetails` | `session`, `user`, `rider` | Returns signed profile URL in `profilePictureKey`. |
| `routes.rides.getRiderCurrentRideById` | `packages/api/convex/routes/rides.ts` | Public | `id: Id<"ride">` | Ride with rider, driver, vehicle, ratings, reasons | `ride`, `rider`, `driver`, `user`, `vehicle`, `ratings`, `rideReasons` | Exposes OTP only when status is `Driver Arrived`; throws if ride missing. |
| `routes.rides.getRiderCurrentRideByRiderId` | `packages/api/convex/routes/rides.ts` | Public | `riderId` | Current open/active ride or `null` | `ride`, `rider`, `driver`, `user`, `vehicle`, `ratings` | Does not include `Driver Arrived` in the current ride status filter. Needs clarification. |
| `routes.rides.getRiderHistory` | `packages/api/convex/routes/rides.ts` | Public | `riderId`, optional `statuses` array of `Completed` or `Canceled` | Historical rides with driver details | `ride`, `rider`, `driver`, `user`, `ratings` | Default statuses include `Completed`, `Canceled`, and `Abort`; argument validator does not allow `Abort`. |
| `routes.rides.getDriverCurrentRideByDriverId` | `packages/api/convex/routes/rides.ts` | Public | `driverId` | Current accepted ride with rider details or `null` | `driver`, `ride`, `rider`, `user`, `ratings` | Prefers active ride if multiple accepted rides are found. |
| `routes.rides.getRide` | `packages/api/convex/routes/rides.ts` | Session | `sessionToken`, `id` | Ride details with driver, rider, ratings, reasons, signed images | `session`, `user`, `driver`, `rider`, `ride`, `ratings`, `rideReasons` | Returns `null` for driver sessions viewing rejected/no-response rides. OTP is removed from response. |
| `routes.rides.getRiderRide` | `packages/api/convex/routes/rides.ts` | Session | `sessionToken`, `id` | Rider-facing ride details with driver info | `session`, `user`, `ride`, `driver`, `ratings`, `rideReasons` | OTP is removed from response. |
| `routes.rides.getRideRequests` | `packages/api/convex/routes/rides.ts` | Public | `driverId` | Pending open ride requests with rider details | `driver`, `ride`, `rider`, `user`, `ratings` | Used on driver home screen. |
| `routes.rides.getDriverHistory` | `packages/api/convex/routes/rides.ts` | Public | `driverId` | Completed/aborted rides with rider details | `driver`, `ride`, `rider`, `user`, `ratings` | Does not include `Canceled` rides. |
| `routes.rides.getRideToStart` | `packages/api/convex/routes/rides.ts` | Public | `id`, `driverId` | Ride or `null` | `ride` | Returns ride only when driver matches, status is `Driver Arrived`, and request is accepted. |
| `routes.rides.getRideRatings` | `packages/api/convex/routes/rides.ts` | Public | `rideId` | `ratings[]` | `ratings` | Fetches both ratings for a ride. |
| `routes.rides.getDriverRatings` | `packages/api/convex/routes/rides.ts` | Public | `driverId` | `{ ratings, average, total }` | `driver`, `ratings` | Only rider-submitted ratings are included. |
| `routes.rides.getRiderRatings` | `packages/api/convex/routes/rides.ts` | Public | `riderId` | `{ ratings, average, total }` | `rider`, `ratings` | Only driver-submitted ratings are included. |

Example query input:

```json
{
  "sessionToken": "session-uuid",
  "id": "ride_id"
}
```

Example query output shape:

```json
{
  "_id": "ride_id",
  "status": "Active",
  "requestStatus": "Accepted",
  "driver": { "_id": "driver_id", "details": { "firstName": "Asha" } },
  "rider": { "_id": "rider_id", "details": { "firstName": "Ravi" } },
  "ratings": []
}
```

### Mutations

| Procedure | File | Auth | Arguments | Returns | Writes / Side Effects | Errors / Edge Cases |
|---|---|---|---|---|---|---|
| `routes.auth.deleteSession` | `routes/auth.ts` | Public token | `sessionToken` | `undefined` | Deletes matching `session` if present. | No-op if token not found. |
| `routes.rider.registerExpoPushToken` | `routes/rider.ts` | Public | `riderId`, `expoPushToken` | `undefined` | Patches rider push token. | No-op if rider missing. |
| `routes.rider.logout` | `routes/rider.ts` | Public | `riderId` | `undefined` | Clears rider push token. | No-op if rider missing. |
| `routes.rider.addRider` | `routes/rider.ts` | Public | User profile, optional `expoPushToken` | `Id<"user">` | Inserts `user` if needed, inserts `rider`, inserts `userPermission`. | Throws if rider already exists for phone or user creation fails. |
| `routes.rider.registerAsRider` | `routes/rider.ts` | Session | `sessionToken`, optional `expoPushToken` | `undefined` | Inserts rider and `userPermission`. | Throws if rider profile already exists. |
| `routes.rider.updateRider` | `routes/rider.ts` | Session | `sessionToken`, `firstName`, optional `lastName` | `undefined` | Patches user name fields. | Throws if authenticated user has no rider. |
| `routes.rider.uploadProfilePicture` | `routes/rider.ts` | Session | `sessionToken`, optional `profilePictureKey` | `undefined` | Patches user profile picture key. | None explicit beyond auth. |
| `routes.rider.removeProfilePictureKey` | `routes/rider.ts` | Session | `sessionToken` | `undefined` | Clears user profile picture key. | None explicit beyond auth. |
| `routes.rider.toggleGenderMatching` | `routes/rider.ts` | Public | `id: Id<"rider">` | `undefined` | Toggles rider `genderMatching`. | Throws if rider missing. |
| `routes.driver.login` | `routes/driver.ts` | Public | `driverId`, `expoPushToken` | `undefined` | Sets push token and availability based on whether any ride exists for driver. | No-op if driver missing. |
| `routes.driver.logout` | `routes/driver.ts` | Public token | `sessionToken` | `undefined` | Sets driver offline/unavailable and clears push token. | No-op for invalid session or missing driver. |
| `routes.driver.addDriver` | `routes/driver.ts` | Public | User, license, organization, optional images/token | `Id<"user">` | Inserts user if needed, permission, and driver. | Throws duplicate driver, missing organization, or user creation failure. |
| `routes.driver.registerAsDriver` | `routes/driver.ts` | Session | `sessionToken`, license, organization, optional images/token | `undefined` | Inserts driver and permission row. | Throws duplicate profile or missing organization. Inserts permission `"Rider"` in current code. |
| `routes.driver.updateDriver` | `routes/driver.ts` | Session | `sessionToken`, names, license fields, `organizationId` | `undefined` | Patches user and driver license/org fields. | Enforces organization license requirements and edit policy. Uses current driver organization for policy, not new `organizationId`. |
| `routes.driver.uploadProfilePicture` | `routes/driver.ts` | Session | `sessionToken`, optional `profilePictureKey` | `undefined` | Patches user profile picture key. | None explicit beyond auth. |
| `routes.driver.removeProfilePictureKey` | `routes/driver.ts` | Session | `sessionToken` | `undefined` | Clears user profile picture key. | None explicit beyond auth. |
| `routes.driver.updatePaymentQrCode` | `routes/driver.ts` | Public | `driverId`, optional `paymentQrCodeKey` | `undefined` | Patches driver's payment QR key. | Throws if driver missing. |
| `routes.driver.updateLicense` | `routes/driver.ts` | Public | `driverId`, `number`, optional front/back keys | `undefined` | Patches license fields and verification state. | Enforces organization edit and verification policy. |
| `routes.driver.toggleAvailability` | `routes/driver.ts` | Public | `id: Id<"driver">` | `undefined` | Toggles `isOnline` and `isAvailableForRide`. | Throws if driver missing or has pending/active rides while going offline. Current filter contains contradictory `requestStatus` conditions inside one `and`. |
| `routes.driver.toggleGenderMatching` | `routes/driver.ts` | Public | `id: Id<"driver">` | `undefined` | Toggles driver `genderMatching`. | Throws if driver missing. |
| `routes.vehicle.addVehicle` | `routes/vehicle.ts` | Public | Vehicle fields, owner, optional image keys | `Id<"vehicle">` | Inserts vehicle. | Validates capacity 2-50, driver/org existence, required images, duplicate registration, and one vehicle per driver. |
| `routes.vehicle.updateVehicle` | `routes/vehicle.ts` | Public | Vehicle id and full vehicle fields | `undefined` | Patches vehicle and verification/image fields. | Enforces organization edit and image requirements; no capacity range check. |
| `routes.organizations.createOrganization` | `routes/organizations.ts` | Public | Organization fields except polygon/bounding box | `Id<"organization">` | Inserts organization. | No duplicate checks. |
| `routes.organizations.updateOrganization` | `routes/organizations.ts` | Public | `id` plus optional editable fields | Updated organization or `null` | Patches provided fields. | Throws if organization not found. Does not accept insurance requirement, polygon, or bounding box. |
| `routes.organizations.deleteOrganization` | `routes/organizations.ts` | Public | `id` | `{ success: true, id }` | Deletes organization. | Throws if missing. Does not cascade drivers/rates. |
| `routes.organizations.createOrganizationRate` | `routes/organizations.ts` | Public | Rate fields | `Id<"organizationsRate">` | Inserts rate. | Does not verify organization exists. |
| `routes.organizations.updateOrganizationRate` | `routes/organizations.ts` | Public | `id` plus optional rate fields | Updated rate or `null` | Patches provided fields. | Throws if missing. |
| `routes.organizations.deleteOrganizationRate` | `routes/organizations.ts` | Public | `id` | `{ success: true, id }` | Deletes one rate. | Throws if missing. |
| `routes.organizations.deleteAllOrganizationRates` | `routes/organizations.ts` | Public | `organizationId` | `organizationsRate[]` | Reads rates only. | Despite the name/comment, it does not delete rates in current code. |
| `routes.rides.hasReachedDestination` | `routes/rides.ts` | Public | `rideId`, `driverId` | `undefined` | Sets `hasReachedDestionation` to `true`. | No-op unless ride is active and not already marked; throws if driver mismatch. |
| `routes.rides.submitRating` | `routes/rides.ts` | Public | `rideId`, `raterType`, `score`, optional `comment` | `undefined` | Inserts rating. | Score must be 1-5; ride must be `Completed` or `Abort`; one rating per ride/raterType. |
| `routes.rides.updateRating` | `routes/rides.ts` | Public | `ratingId`, `raterType`, `raterId`, optional `score/comment` | `undefined` | Patches rating. | Requires ownership, same rater type, score 1-5, and creation within 24 hours. |
| `routes.rides.deleteRating` | `routes/rides.ts` | Public | `ratingId`, `raterType`, `raterId` | `undefined` | Deletes rating. | Requires ownership, same rater type, and creation within 24 hours. |

Example mutation input:

```json
{
  "rideId": "ride_id",
  "raterType": "Rider",
  "score": 5,
  "comment": "Clean vehicle and smooth trip"
}
```

Example mutation output:

```json
null
```

Convex JavaScript clients receive `undefined` for mutations that do not explicitly return a value.

### Actions

| Procedure | File | Auth | Arguments | Returns | Reads / Writes | External services | Side effects and edge cases |
|---|---|---|---|---|---|---|---|
| `actions.auth.sendOtp` | `actions/auth.ts` | Public | `phoneNumber` | `{ success: true }` | Upserts `otpSession` | SMS gateway via `SMS_URL` and `SMS_LICENSE` | Generates 6-digit OTP, stores SHA-256 hash, sends SMS. Throws if env missing or SMS response is not OK. |
| `actions.auth.verifyOtp` | `actions/auth.ts` | Public | `phoneNumber`, `otp` | Existing user: `{ userExists: true, sessionToken, userId }`; new user: `{ userExists: false, sessionToken: null, userId: null }` | Reads/deletes/increments `otpSession`; reads `user`; inserts `session` for existing user | None | Deletes expired/successful OTP sessions. Strips `+91` before user lookup. |
| `actions.auth.createSessionForUser` | `actions/auth.ts` | Public | `userId`, `phoneNumber` | `{ sessionToken }` | Inserts `session` | None | Used after registration to create a session. |
| `actions.upload.getPresignedUrl` | `actions/upload.ts` | Session | `sessionToken`, `key`, `contentType` | `{ url, key }` | Reads `session`, `user` | S3/MinIO presigner | Generates PUT URL. Code comment says 1 hour but `expiresIn` is 300 seconds. |
| `actions.actions.getNearbyDrivers` | `actions/actions.ts` | Session | `sessionToken`, pickup/destination coords, `riderId`, `distance`, `genderMatch`, `filters` | Nearby driver result array | Reads `rideSettings`, then internal ride/driver/vehicle/rating/rate data | Ably REST presence endpoint | Fetches live driver coordinates from Ably, filters by radius, calls internal query for DB enrichment. Returns `[]` on many failures after logging. |
| `actions.ride.bookRide` | `actions/ride.ts` | Session | Rider, driver, fare, pickup, destination, distance, optional duration | `Id<"ride">` | Inserts `ride`; schedules no-response mutation | Expo push | Notifies driver of new request if token exists. |
| `actions.ride.acceptRideAction` | `actions/ride.ts` | Session | `driverId`, `rideId` | `undefined` | Patches ride/driver and other pending requests | Expo push | Notifies rider that ride was accepted. |
| `actions.ride.changeDriver` | `actions/ride.ts` | Session | `rideId`, `riderId`, `driverId` | `undefined` | Patches ride assigned driver; may release old driver | Expo push | Notifies new driver only when returned ride had `requestStatus === "Accepted"` before change. |
| `actions.ride.cancelRide` | `actions/ride.ts` | Session | `riderId`, `rideId` | `undefined` | Patches ride canceled; may release driver | Expo push | Rider cancel without reason. Public `riderCancelRide` handles reason and active abort. |
| `actions.ride.calculateRiderCancelRideCharges` | `actions/ride.ts` | Session | `rideId`, `driverLocation` | Fare breakdown | Reads ride, organization rate, settings | Google Directions | Computes rider cancellation/abort fare and penalty based on covered distance. |
| `actions.ride.riderCancelRide` | `actions/ride.ts` | Session | `rideId`, `riderId`, `reason`, optional `driverLocation` | `undefined` | Patches ride, inserts reason, may release driver | Google Directions, Google Geocoding, Expo push | Active rides become `Abort` with recalculated fare; other allowed stages become `Canceled`. Requires location for active rides. |
| `actions.ride.calculateDriverCancelRideCharges` | `actions/ride.ts` | Session | `id`, `driverLocation` | Fare breakdown | Reads ride, organization rate, settings | Google Directions | Computes driver-side abort fare based on covered distance after arrival radius threshold. |
| `actions.ride.driverCancelRide` | `actions/ride.ts` | Session | `rideId`, `driverId`, `reason`, `driverLocation` | `undefined` | Patches ride, inserts reason, releases driver | Google Directions, Google Geocoding, Expo push | Active rides become `Abort`; non-active rides are marked `Open` with `requestStatus: "Rejected"`. |
| `actions.ride.rejectRide` | `actions/ride.ts` | Session | `driverId`, `rideId` | `undefined` | Patches ride request as rejected | Expo push | Notifies rider that request was declined. |
| `actions.ride.driverArrived` | `actions/ride.ts` | Session | `rideId`, `driverId` | `undefined` | Patches ride status, arrival time, OTP | Expo push | Generates 4-digit ride OTP and notifies rider. |
| `actions.ride.generateRideOtp` | `actions/ride.ts` | Session | `rideId` | `undefined` | Patches ride OTP | Expo push | Generates replacement 4-digit OTP and notifies rider. |
| `actions.ride.startRide` | `actions/ride.ts` | Session | `driverId`, `rideId`, `otp` | `undefined` | Patches ride active/start time | Expo push | Validates OTP and status before starting ride. |
| `actions.ride.completeRide` | `actions/ride.ts` | Session | `driverId`, `rideId`, `driverLocation` | `undefined` | Patches ride completed/fare/distance/dropoff, releases driver | Google Directions, Google Geocoding, Expo push | Requires `hasReachedDestionation` to be true in internal mutation. Adds extra distance/fare if driver location is outside arrival radius. |

Example action input:

```json
{
  "sessionToken": "session-uuid",
  "riderId": "rider_id",
  "driverId": "driver_id",
  "fare": 120,
  "pickup": { "address": "Hostel 1", "latitude": 19.1334, "longitude": 72.9133 },
  "destination": { "address": "Main Gate", "latitude": 19.1300, "longitude": 72.9180 },
  "distance": 1800,
  "expectedDuration": "8 mins"
}
```

Example action output:

```json
"ride_id"
```

### Internal Queries and Mutations

Internal procedures are callable only from Convex functions/actions, not directly by frontend clients.

| Procedure | Type | File | Purpose | Reads | Writes / Returns |
|---|---|---|---|---|---|
| `routes.auth.upsertOtpSession` | Internal mutation | `routes/auth.ts` | Create or replace OTP hash and expiration for a phone number. | `otpSession` | Inserts or patches `otpSession`. |
| `routes.auth.getOtpSession` | Internal query | `routes/auth.ts` | Fetch OTP session by phone. | `otpSession` | Returns session or `null`. |
| `routes.auth.deleteOtpSession` | Internal mutation | `routes/auth.ts` | Delete OTP session by phone. | `otpSession` | Deletes if present. |
| `routes.auth.incrementAttempts` | Internal mutation | `routes/auth.ts` | Track incorrect OTP attempt. | `otpSession` | Patches attempts or deletes session at max attempts. |
| `routes.auth.createSession` | Internal mutation | `routes/auth.ts` | Create app session. | None | Inserts `session`, returns token. |
| `routes.auth.getSessionByToken` | Internal query | `routes/auth.ts` | Validate token and expiration. | `session` | Returns valid session or `null`. |
| `routes.auth.getUserByPhone` | Internal query | `routes/auth.ts` | Lookup user by phone. | `user` | Returns user or `null`. |
| `routes.auth.getUserByIdInternal` | Internal query | `routes/auth.ts` | Lookup user by id. | `user` | Returns user or `null`. |
| `routes.settings.rideSettingsInternal` | Internal query | `routes/settings.ts` | Fetch global ride settings. | `rideSettings` | Returns settings or throws. |
| `routes.driver.getDriverInternal` | Internal query | `routes/driver.ts` | Fetch driver with vehicle for actions. | `driver`, `vehicle` | Returns `{ ...driver, vehicle }` or throws. |
| `routes.organizations.getOrganizationRatesInternal` | Internal query | `routes/organizations.ts` | Fetch organization rates for actions. | `organizationsRate` | Returns rate array. |
| `routes.rides.getNearbyDriversQueryResultInternal` | Internal query | `routes/rides.ts` | Enrich Ably presence driver data with DB profile, vehicle, ratings, organization, and fare. | `rider`, `user`, `rideSettings`, `driver`, `ride`, `vehicle`, `ratings`, `organization`, `organizationsRate` | Returns nearby-driver result array. |
| `routes.rides.bookRideInternal` | Internal mutation | `routes/rides.ts` | Validate rider/driver and create pending ride request. | `rider`, `driver`, `ride`, `rideSettings` | Inserts `ride`, schedules no-response job, returns ride id and driver push token. |
| `routes.rides.markNoResponseInternal` | Internal mutation | `routes/rides.ts` | Mark pending ride request as no response after timeout. | `ride`, `rider` | Patches `ride.requestStatus`. |
| `routes.rides.changeDriverInternal` | Internal mutation | `routes/rides.ts` | Reassign an existing ride to a new driver. | `ride`, `driver`, `rideSettings` | Patches old driver, ride driver/request status, schedules no-response job. |
| `routes.rides.cancelRideInternal` | Internal mutation | `routes/rides.ts` | Rider cancellation for open/arrived rides. | `rider`, `ride`, `driver` | Patches ride canceled, inserts optional reason, may release driver, returns driver push token. |
| `routes.rides.riderAbortRideInternal` | Internal mutation | `routes/rides.ts` | Rider abort of active ride after fare recalculation. | `rider`, `ride`, `driver` | Patches ride abort fields, inserts reason, releases driver, returns driver push token. |
| `routes.rides.driverCancelRideInternal` | Internal mutation | `routes/rides.ts` | Driver rejection/cancellation/abort. | `driver`, `ride`, `rider` | Patches ride, inserts reason, releases driver, returns rider push token. |
| `routes.rides.getDetailsInternal` | Internal query | `routes/rides.ts` | Fetch ride by id for actions. | `ride` | Returns ride or throws. |
| `routes.rides.rideOrganizationRateInternal` | Internal query | `routes/rides.ts` | Fetch ride plus matching organization rate. | `ride`, `driver`, `vehicle`, `organization`, `organizationsRate` | Returns `{ organizationRate, ride }` or throws. |
| `routes.rides.rejectRideInternal` | Internal mutation | `routes/rides.ts` | Driver rejects a pending ride request. | `driver`, `ride`, `rider` | Patches request rejected, returns rider push token. |
| `routes.rides.acceptRideInternal` | Internal mutation | `routes/rides.ts` | Driver accepts a ride request. | `driver`, `ride`, `rider` | Patches ride accepted, marks other pending requests no-response, marks driver unavailable, returns rider push token. |
| `routes.rides.driverArrivedInternal` | Internal mutation | `routes/rides.ts` | Mark driver arrived and store ride OTP. | `ride`, `rider` | Patches ride status/OTP/arrival time, returns rider push token. |
| `routes.rides.generateRideOtpInternal` | Internal mutation | `routes/rides.ts` | Replace ride OTP. | `ride`, `rider` | Patches ride OTP, returns rider push token. |
| `routes.rides.startRideInternal` | Internal mutation | `routes/rides.ts` | Validate OTP and start ride. | `driver`, `ride`, `rider` | Patches ride active/start time, returns rider push token. |
| `routes.rides.completeRideInternal` | Internal mutation | `routes/rides.ts` | Complete active ride after destination reached. | `driver`, `ride`, `rider` | Patches ride completed/fare/distance/dropoff, marks driver available, returns rider push token. |

## Ride Lifecycle Summary

| Step | Procedure | Main state changes |
|---|---|---|
| Discover drivers | `actions.actions.getNearbyDrivers` | Reads Ably live locations, filters drivers, computes estimated fare. |
| Book ride | `actions.ride.bookRide` -> `bookRideInternal` | Inserts `ride` as `status: "Open"`, `requestStatus: "Pending"` and schedules timeout. |
| Accept request | `actions.ride.acceptRideAction` -> `acceptRideInternal` | Sets `requestStatus: "Accepted"`, stores `acceptedAt`, marks driver unavailable, marks other pending requests no-response. |
| Reject/no response | `actions.ride.rejectRide` or scheduled `markNoResponseInternal` | Sets `requestStatus` to `Rejected` or `No Response`. |
| Driver arrived | `actions.ride.driverArrived` -> `driverArrivedInternal` | Generates OTP, sets `status: "Driver Arrived"`, stores `arrivedAt`. |
| Start ride | `actions.ride.startRide` -> `startRideInternal` | Verifies OTP, sets `status: "Active"`, stores `startedAt`. |
| Reached destination | `routes.rides.hasReachedDestination` | Sets `hasReachedDestionation: true`. |
| Complete ride | `actions.ride.completeRide` -> `completeRideInternal` | Sets `status: "Completed"`, stores final fare/distance/dropoff, marks driver available. |
| Rider cancel/abort | `actions.ride.riderCancelRide` | Non-active rides become `Canceled`; active rides become `Abort` with recalculated fare and reason. |
| Driver cancel/abort | `actions.ride.driverCancelRide` | Active rides become `Abort`; non-active requests become `Open` with `requestStatus: "Rejected"`. |

## External Integrations

| Integration | Configuration | Used by | Behavior |
|---|---|---|---|
| SMS gateway | `SMS_URL`, `SMS_LICENSE` | `actions.auth.sendOtp` | Sends registration/login OTP SMS. |
| MinIO/S3-compatible storage | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ENDPOINT`, `MINIO_BUCKET` | Upload action and signed image URL queries | Generates signed PUT/GET URLs for profile, license, RC, insurance, and payment QR image keys. |
| Ably | `ABLY_API_KEY` or `EXPO_PUBLIC_ABLY_API_KEY`; `ABLY_URL` or `EXPO_PUBLIC_ABLY_URL` | `actions.actions.getNearbyDrivers` | Reads live presence data containing driver coordinates and driver ids. |
| Google Maps Directions API | `GOOGLE_MAPS_API_KEY` | Fare calculation and ride completion/cancellation actions | Computes remaining distance/duration from current driver location to destination. |
| Google Maps Geocoding API | `GOOGLE_MAPS_API_KEY` | Active ride abort/completion drop-off handling | Converts driver coordinates to a short address. |
| Expo Push Notifications | Optional `EXPO_ACCESS_TOKEN` | Ride actions | Sends push notifications to rider/driver Expo tokens. Invalid token formats are skipped. |

## Authorization Notes For Frontend Developers

- Session-protected functions require a `sessionToken` argument. The custom wrappers remove `sessionToken` before calling the handler and expose `ctx.user`.
- Public ID-based mutations such as `toggleAvailability`, `updatePaymentQrCode`, `updateLicense`, `addVehicle`, `updateVehicle`, and rating mutations rely on supplied document ids and local checks, not authenticated session ownership.
- Driver/rider registration can reuse an existing `user` document if the phone number exists and the specific profile type does not already exist.
- Image fields may have different meanings in responses than in storage. In stored documents they are object keys; in many query responses the same field name contains a short-lived signed URL.
- Convex `Id<"...">` values are opaque strings on the frontend. Use ids returned by queries/mutations rather than constructing them.

## Error Handling

The backend throws `ConvexError` for most business-rule failures, including invalid sessions, missing users, duplicate registrations, missing organizations, invalid ride states, OTP errors, score validation, and missing ride settings. Some organization mutations throw plain `Error` instead of `ConvexError`.

Common edge cases:

- Missing `rideSettings` blocks ride settings queries and any action that depends on settings.
- Missing Google Maps configuration throws in route/geocoding helpers.
- Missing SMS configuration throws before sending OTP.
- Missing Ably configuration throws in nearby-driver discovery.
- Nearby-driver discovery catches many runtime failures and returns `[]` after logging.
- Rating edit/delete is limited to 24 hours from Convex `_creationTime`.
- Expired app sessions are rejected but not automatically removed during validation.

## Open Questions / Missing Information

- What is the intended date format for `user.dob`?
- Should `phoneNumber` be stored consistently with or without the `+91` country code? `verifyOtp` strips `+91` before user lookup, while sessions store the original `phoneNumber` argument.
- Should `routes.driver.registerAsDriver` insert `userPermission.permission: "Driver"` instead of `"Rider"`?
- Should `deleteAllOrganizationRates` actually delete rates? It currently returns matching rates without deleting.
- Should `driverResponseTime` be seconds or minutes? `bookRideInternal` treats it as minutes, while `changeDriverInternal` treats it as seconds.
- Should `getRiderCurrentRideByRiderId` include `Driver Arrived` rides as current rides?
- Should `updateOrganization` support `isVehicleInsuranceImageRequired`, `polygon`, and `boundingBox`?
- Should public ID-based mutations be converted to session-protected mutations with ownership checks?
- Should database-level uniqueness be added for one rider per user, one driver per user, one vehicle per driver, and one organization rate per class?
- Should schema typos (`isLicenseVerficationRequired`, `canDriverEditLicesnse`, `hasReachedDestionation`, `by_organizition`) be retained for compatibility or migrated?
- No backend procedures were found for admin verification of riders, licenses, or vehicles.
- No backend procedures were found to create or update `rideSettings`.
