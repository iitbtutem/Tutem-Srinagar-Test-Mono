---
puppeteer:
  format: A3
  landscape: true
  printBackground: true
---

# Project Backend Documentation

## Overview

This project uses a Convex backend located in `packages/api/convex`. The backend supports a ride-hailing style workflow with rider and driver profiles, organization-specific vehicle and license requirements, organization fare rates, ride requests, ride lifecycle transitions, ratings, OTP authentication, file uploads through S3-compatible storage, push notifications, Ably presence-based driver discovery, and Google Maps route/geocoding calls.

Generated Convex bindings are exported from `packages/api/index.js` and `packages/api/index.d.ts`. The repository README notes that app code should import from `@tutem/api` instead of importing `convex/_generated` directly.

## Backend Structure

| Path                                               | Purpose                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api/convex/schema.ts`                    | Convex database schema and indexes.                                                                                             |
| `packages/api/convex/routes/*.ts`                  | Public queries/mutations plus internal queries/mutations grouped by domain.                                                     |
| `packages/api/convex/actions/*.ts`                 | Node actions for OTP/SMS, ride side effects (push notifications), S3 presigned uploads, and Ably-based nearby-driver discovery. |
| `packages/api/convex/helpers/sessionFunctions.ts`  | Custom authenticated query/mutation wrappers and action session validation.                                                     |
| `packages/api/convex/helpers/maps.ts`              | Google Maps Directions and Geocoding helpers plus geometry helpers.                                                             |
| `packages/api/convex/helpers/pushNotifications.ts` | Expo push notification helpers.                                                                                                 |
| `packages/api/convex/s3.ts`                        | S3-compatible client configured with MinIO environment variables.                                                               |
| `packages/api/convex/CONSTANTS.ts`                 | Enumerations and timing constants.                                                                                              |

Convex documents always include Convex-managed `_id` and `_creationTime` fields even when not listed in table schemas below.

## Shared Constants

| Constant                          | Value                                | Used for                                                                     |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `GENDER`                          | `Male`, `Female`, `Other`            | User gender values.                                                          |
| `VEHICLE_TYPE`                    | `Bike`, `Car`, `Truck`, `SUV`, `Van` | Vehicle type values.                                                         |
| `FUEL_TYPE`                       | `Petrol`, `Diesel`, `EV`             | Vehicle fuel type values.                                                    |
| `VEHICLE_CLASS`                   | `Bike`, `Auto`, `Cab`                | Fare class and driver-filter values.                                         |
| `PERMISSIONS`                     | `Driver`, `Rider`, `Admin`           | User permission values.                                                      |
| `RIDE_OTP_SIZE`                   | `4`                                  | Ride-start OTP length.                                                       |
| `OTP_SIZE`                        | `6`                                  | Login OTP length.                                                            |
| `OTP_ATTEMPTS` and `MAX_ATTEMPTS` | `5`                                  | OTP verification attempt limits.                                             |
| `OTP_EXPIRY_MS`                   | `5`                                  | Used as minutes in code via `OTP_EXPIRY_MS * 1000 * 60`. Name is misleading. |
| `TWENTY_FOUR_HOURS`               | `24 * 60 * 60 * 1000`                | Rating edit/delete window.                                                   |
| `METERS_IN_KM`                    | `1000`                               | Fare calculations.                                                           |

## Database Schema

### Table: `user`

Purpose: Stores shared profile and identity data for people who can become riders, drivers, or both.

| Field               | Type                         | Required | Default | Description                                                                                                   | Relationship / Reference |
| ------------------- | ---------------------------- | -------: | ------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `firstName`         | `string`                     |      Yes | None    | User first name.                                                                                              | None                     |
| `lastName`          | `string`                     |       No | None    | User last name.                                                                                               | None                     |
| `dob`               | `string`                     |      Yes | None    | Date of birth string. Exact format is not validated in the backend.                                           | None                     |
| `profilePictureKey` | `string`                     |       No | None    | Object-storage key for the profile image. Several queries replace this with a signed URL in returned objects. | MinIO/S3 object key      |
| `gender`            | `Male`, `Female`, or `Other` |      Yes | None    | Used for rider/driver gender matching.                                                                        | None                     |
| `phoneNumber`       | `string`                     |      Yes | None    | Phone number used for lookup and OTP session creation.                                                        | Referenced by auth flow  |

Indexes:

| Name             | Fields        | Purpose                                                                     |
| ---------------- | ------------- | --------------------------------------------------------------------------- |
| `by_phoneNumber` | `phoneNumber` | Finds existing users during OTP verification and rider/driver registration. |

Usage notes:

- Inserted by `routes.rider.addRider` and `routes.driver.addDriver` when no user exists for the phone number.
- Read by auth, rider, driver, ride, and rating queries.
- `phoneNumber` uniqueness is enforced only in application code by checking the index before inserting.

### Table: `rider`

Purpose: Stores rider-specific profile state linked to a `user`.

| Field            | Type                                 | Required | Default             | Description                                | Relationship / Reference              |
| ---------------- | ------------------------------------ | -------: | ------------------- | ------------------------------------------ | ------------------------------------- |
| `isVerified`     | `Pending`, `Rejected`, or `Verified` |      Yes | Usually `"Pending"` | Rider verification status.                 | None                                  |
| `userId`         | `Id<"user">`                         |      Yes | None                | Owning user document.                      | References `user._id`                 |
| `expoPushToken`  | `string`                             |       No | None                | Expo push token for rider notifications.   | Expo push service                     |
| `genderMatching` | `boolean`                            |      Yes | Usually `false`     | Rider preference for same-gender matching. | Compared against driver user's gender |

Indexes:

| Name      | Fields   | Purpose                                           |
| --------- | -------- | ------------------------------------------------- |
| `by_user` | `userId` | Finds a rider profile for the authenticated user. |

Usage notes:

- Created by `routes.rider.addRider` and `routes.rider.registerAsRider`.
- Used throughout ride booking and ride display flows.

### Table: `driver`

Purpose: Stores driver-specific profile, license, online/availability state, organization membership, and notification data.

| Field                  | Type                                 | Required | Default                            | Description                                       | Relationship / Reference                   |
| ---------------------- | ------------------------------------ | -------: | ---------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| `licenseNumber`        | `string`                             |      Yes | None                               | Driver license number.                            | None                                       |
| `licenseImageFrontKey` | `string`                             |       No | None                               | Object-storage key for front license image.       | MinIO/S3 object key                        |
| `licenseImageBackKey`  | `string`                             |       No | None                               | Object-storage key for back license image.        | MinIO/S3 object key                        |
| `paymentQrCodeKey`     | `string`                             |       No | None                               | Object-storage key for payment QR image.          | MinIO/S3 object key                        |
| `isLicenseVerified`    | `Pending`, `Rejected`, or `Verified` |      Yes | Derived from organization settings | License verification state.                       | Controlled by organization requirements    |
| `isOnline`             | `boolean`                            |      Yes | Usually `true` on creation         | Whether the driver is online.                     | Used by discovery and availability toggles |
| `isAvailableForRide`   | `boolean`                            |      Yes | Usually `true` on creation         | Whether driver can receive or accept rides.       | Mutated by ride lifecycle                  |
| `organizationId`       | `Id<"organization">`                 |      Yes | None                               | Driver's organization.                            | References `organization._id`              |
| `userId`               | `Id<"user">`                         |      Yes | None                               | Owning user document.                             | References `user._id`                      |
| `expoPushToken`        | `string`                             |       No | None                               | Expo push token for driver notifications.         | Expo push service                          |
| `genderMatching`       | `boolean`                            |      Yes | Usually `false`                    | Driver preference for same-gender rider matching. | Compared against rider user's gender       |

Indexes:

| Name              | Fields           | Purpose                                            |
| ----------------- | ---------------- | -------------------------------------------------- |
| `by_user`         | `userId`         | Finds a driver profile for the authenticated user. |
| `by_organization` | `organizationId` | Finds drivers by organization.                     |

Usage notes:

- Created by `routes.driver.addDriver` and `routes.driver.registerAsDriver`.
- `isAvailableForRide` is set to `false` after accepting a ride and `true` after cancellation, abort, or completion.
- Several image key fields are returned as temporary signed URLs by queries.

### Table: `organization`

Purpose: Defines operating organizations, driver/vehicle verification policy, edit policy, and optional service-area geometry.

| Field                             | Type                                                            | Required | Default | Description                                             | Relationship / Reference          |
| --------------------------------- | --------------------------------------------------------------- | -------: | ------- | ------------------------------------------------------- | --------------------------------- |
| `name`                            | `string`                                                        |      Yes | None    | Organization name.                                      | None                              |
| `address`                         | `string`                                                        |      Yes | None    | Organization address.                                   | None                              |
| `isLicenseVerficationRequired`    | `boolean`                                                       |      Yes | None    | Whether license images/verification are required.       | Used by driver mutations          |
| `isVehicleRCVerificationRequired` | `boolean`                                                       |      Yes | None    | Whether vehicle RC image and verification are required. | Used by vehicle mutations         |
| `isVehicleInsuranceImageRequired` | `boolean`                                                       |      Yes | None    | Whether insurance image is required.                    | Used by vehicle mutations         |
| `canDriverEditLicesnse`           | `boolean`                                                       |      Yes | None    | Whether driver can edit license details.                | Used by driver mutations          |
| `canDriverEditVehicle`            | `boolean`                                                       |      Yes | None    | Whether driver can edit vehicle details.                | Used by vehicle mutations         |
| `polygon`                         | `Array<{ latitude: number, longitude: number }>`                |       No | None    | Optional service-area polygon.                          | Used by nearby-organization query |
| `boundingBox`                     | Object with `north`, `south`, `east`, `west` coordinate objects |       No | None    | Optional precomputed box used before polygon filtering. | Used by nearby-organization query |

Indexes: None.

Usage notes:

- CRUD mutations exist for organizations.
- Drivers reference organizations.
- Organization rates reference organizations and drive fare calculation.

### Table: `organizationsRate`

Purpose: Stores organization fare configuration by vehicle class.

| Field              | Type                     | Required | Default | Description                                                      | Relationship / Reference      |
| ------------------ | ------------------------ | -------: | ------- | ---------------------------------------------------------------- | ----------------------------- |
| `vehicleClass`     | `Bike`, `Auto`, or `Cab` |      Yes | None    | Vehicle class the rate applies to.                               | Matches `vehicle.class`       |
| `baseDistance`     | `number`                 |      Yes | None    | Base included distance, stored in meters.                        | None                          |
| `baseDistanceRate` | `number`                 |      Yes | None    | Base fare for base distance.                                     | None                          |
| `ratePerKm`        | `number`                 |      Yes | None    | Incremental fare rate per kilometer.                             | None                          |
| `waitingPerMinute` | `number`                 |      Yes | None    | Waiting-rate field. waiting rate per 5 minutes. Not impleted yet | None                          |
| `organizationId`   | `Id<"organization">`     |      Yes | None    | Organization that owns the rate.                                 | References `organization._id` |

Indexes:

| Name              | Fields           | Purpose                                                         |
| ----------------- | ---------------- | --------------------------------------------------------------- |
| `by_organization` | `organizationId` | Fetches rates for an organization and filters by vehicle class. |

Usage notes:

- Used in nearby-driver fare estimates and ride cancellation/completion fare recalculation.
- Code does not enforce one rate per organization per vehicle class.

### Table: `vehicle`

Purpose: Stores a driver's registered vehicle and verification state.

| Field                | Type                                    | Required | Default                            | Description                             | Relationship / Reference                  |
| -------------------- | --------------------------------------- | -------: | ---------------------------------- | --------------------------------------- | ----------------------------------------- |
| `isVerified`         | `Pending`, `Rejected`, or `Verified`    |      Yes | Derived from organization settings | Vehicle verification status.            | Controlled by organization settings       |
| `registrationNumber` | `string`                                |      Yes | None                               | Vehicle registration number.            | Application code checks uniqueness        |
| `rcImageKey`         | `string`                                |       No | None                               | Object-storage key for RC image.        | MinIO/S3 object key                       |
| `insuranceImageKey`  | `string`                                |       No | None                               | Object-storage key for insurance image. | MinIO/S3 object key                       |
| `model`              | `string`                                |      Yes | None                               | Vehicle model.                          | None                                      |
| `type`               | `Bike`, `Car`, `Truck`, `SUV`, or `Van` |      Yes | None                               | Vehicle type.                           | None                                      |
| `fuelType`           | `Petrol`, `Diesel`, or `EV`             |      Yes | None                               | Fuel type.                              | None                                      |
| `class`              | `Bike`, `Auto`, or `Cab`                |      Yes | None                               | Vehicle class.                          | Matches `organizationsRate.vehicleClass`  |
| `color`              | `string`                                |      Yes | None                               | Vehicle color.                          | None                                      |
| `seatingCapacity`    | `number`                                |      Yes | None                               | Seat count.                             | Validated between 2 to 50 in `addVehicle` |
| `ownerId`            | `Id<"driver">`                          |      Yes | None                               | Driver who owns the vehicle.            | References `driver._id`                   |

Indexes:

| Name                    | Fields               | Purpose                                |
| ----------------------- | -------------------- | -------------------------------------- |
| `by_owner`              | `ownerId`            | Finds a driver's vehicle.              |
| `by_registrationNumber` | `registrationNumber` | Checks duplicate vehicle registration. |

Usage notes:

- Code enforces one vehicle per driver in `addVehicle`.

### Table: `userPermission`

Purpose: Stores role-like permissions for users.

| Field        | Type                          | Required | Default | Description                        | Relationship / Reference |
| ------------ | ----------------------------- | -------: | ------- | ---------------------------------- | ------------------------ |
| `permission` | `Driver`, `Rider`, or `Admin` |      Yes | None    | Permission assigned to the user.   | None                     |
| `userId`     | `Id<"user">`                  |      Yes | None    | User that receives the permission. | References `user._id`    |

Indexes:

| Name      | Fields   | Purpose                                                                        |
| --------- | -------- | ------------------------------------------------------------------------------ |
| `by_user` | `userId` | Fetch permissions for a user. No inspected backend procedure reads this table. |

Usage notes:

- Inserted during rider (`routes.rider.addRider`, `routes.rider.registerAsRider`) and driver (`routes.driver.addDriver`, `routes.driver.registerAsDriver`) registration.

### Table: `ride`

Purpose: Stores ride requests and lifecycle state.

| Field                   | Type                                                                    | Required | Default                 | Description                                                                              | Relationship / Reference                                  |
| ----------------------- | ----------------------------------------------------------------------- | -------: | ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `riderId`               | `Id<"rider">`                                                           |      Yes | None                    | Rider who requested the ride.                                                            | References `rider._id`                                    |
| `driverId`              | `Id<"driver">`                                                          |      Yes | None                    | Driver currently assigned to the ride request.                                           | References `driver._id`                                   |
| `fare`                  | `number`                                                                |      Yes | None                    | Current ride fare, initially estimated and later recalculated for abort/completion.      | Uses organization rate                                    |
| `hasReachedDestination` | `boolean`                                                               |      Yes | Usually `false`         | Whether destination has been reached.                                                    | Set by `hasReachedDestination`                            |
| `status`                | `Open`, `Active`, `Driver Arrived`, `Abort`, `Completed`, or `Canceled` |      Yes | `"Open"` on booking     | Ride lifecycle status.                                                                   | None                                                      |
| `requestStatus`         | `Pending`, `Accepted`, `Rejected`, or `No Response`                     |      Yes | `"Pending"` on booking  | Driver response state for the request.                                                   | None                                                      |
| `pickup`                | `{ address: string, latitude: number, longitude: number }`              |      Yes | None                    | Pickup location.                                                                         | None                                                      |
| `destination`           | `{ address: string, latitude: number, longitude: number }`              |      Yes | None                    | Intended destination.                                                                    | None                                                      |
| `dropOff`               | `{ address: string, latitude: number, longitude: number }`              |       No | None                    | Actual drop-off/abort location when different or available.                              | Derived from Google Maps geocoding using drivers location |
| `distance`              | `number`                                                                |      Yes | None                    | Ride distance in meters in.                                                              | None                                                      |
| `expectedDuration`      | `string`                                                                |       No | None                    | Estimated duration text from caller.                                                     | None                                                      |
| `otp`                   | `number`                                                                |       No | None                    | Ride-start OTP generated after arrival. Hidden in several driver-facing query responses. | None                                                      |
| `updatedAt`             | `number`                                                                |      Yes | `Date.now()` on writes  | Last update timestamp in milliseconds.                                                   | None                                                      |
| `requestedAt`           | `number`                                                                |      Yes | `Date.now()` on booking | Request timestamp in milliseconds.                                                       | None                                                      |
| `acceptedAt`            | `number`                                                                |       No | None                    | Acceptance timestamp.                                                                    | None                                                      |
| `arrivedAt`             | `number`                                                                |       No | None                    | Driver-arrived timestamp.                                                                | None                                                      |
| `startedAt`             | `number`                                                                |       No | None                    | Ride-start timestamp.                                                                    | None                                                      |
| `completedAt`           | `number`                                                                |       No | None                    | Completion timestamp.                                                                    | None                                                      |

Indexes:

| Name        | Fields     | Purpose                                            |
| ----------- | ---------- | -------------------------------------------------- |
| `by_rider`  | `riderId`  | Finds rider current rides and history.             |
| `by_driver` | `driverId` | Finds driver requests, current rides, and history. |

Usage notes:

- Ride flow is primarily orchestrated by actions in `actions/ride.ts`, which call internal mutations in `routes/rides.ts`.
- Booking schedules `markNoResponseInternal` after the configured driver response time.
- Active rides can be aborted by either party with fare recalculation.

### Table: `rideReasons`

Purpose: Stores cancellation or abort reasons for rides.

| Field      | Type           | Required | Default | Description                                                | Relationship / Reference |
| ---------- | -------------- | -------: | ------- | ---------------------------------------------------------- | ------------------------ |
| `rideId`   | `Id<"ride">`   |      Yes | None    | Ride the reason belongs to.                                | References `ride._id`    |
| `driverId` | `Id<"driver">` |       No | None    | Driver who supplied the reason. Omitted for rider reasons. | References `driver._id`  |
| `reason`   | `string`       |      Yes | None    | Human-entered reason text.                                 | None                     |

Indexes:

| Name      | Fields   | Purpose                           |
| --------- | -------- | --------------------------------- |
| `by_ride` | `rideId` | Fetches reasons for ride details. |

### Table: `ratings`

Purpose: Stores one rider-submitted and one driver-submitted rating per ride.

| Field       | Type                | Required | Default | Description                         | Relationship / Reference                     |
| ----------- | ------------------- | -------: | ------- | ----------------------------------- | -------------------------------------------- |
| `rideId`    | `Id<"ride">`        |      Yes | None    | Rated ride.                         | References `ride._id`                        |
| `riderId`   | `Id<"rider">`       |      Yes | None    | Rider in the ride.                  | References `rider._id`                       |
| `driverId`  | `Id<"driver">`      |      Yes | None    | Driver in the ride.                 | References `driver._id`                      |
| `raterType` | `Rider` or `Driver` |      Yes | None    | Indicates who submitted the rating. | Used to infer rated party                    |
| `score`     | `number`            |      Yes | None    | Rating score.                       | Validated as 1 through 5 by rating mutations |
| `comment`   | `string`            |       No | None    | Optional rating comment.            | None                                         |

Indexes:

| Name        | Fields     | Purpose                                                           |
| ----------- | ---------- | ----------------------------------------------------------------- |
| `by_ride`   | `rideId`   | Fetch ratings for one ride and enforce duplicate check by filter. |
| `by_rider`  | `riderId`  | Compute rider average from driver ratings.                        |
| `by_driver` | `driverId` | Compute driver average from rider ratings.                        |

Usage notes:

- `submitRating` prevents duplicate ratings by `rideId` plus `raterType`.

### Table: `rideSettings`

Purpose: Stores global ride behavior configuration.

| Field                   | Type     | Required | Default                                        | Description                                                                           | Relationship / Reference        |
| ----------------------- | -------- | -------: | ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| `nearbyRadius`          | `number` |      Yes | None                                           | Driver discovery radius. Stored in meters                                             | Used by nearby-driver discovery |
| `arrivedDistance`       | `number` |      Yes | None                                           | Distance threshold for arrival/completion/cancellation fare logic, treated as meters. | Used by ride actions            |
| `driverResponseTime`    | `number` |      Yes | 10 minutes.                                    | Driver response timeout in minutes.                                                   | Used by scheduler               |
| `maxDriverRideRequests` | `number` |       No | Defaults to `3` in nearby-driver filtering     | Max pending ride requests a driver can have.                                          | Used by discovery               |
| `cancellationPenalty`   | `number` |       No | Defaults to `50` in rider cancellation actions | Penalty amount for rider active-ride cancellation before destination.                 | Used by fare calculation        |

Indexes: None.

Usage notes:

- Queries throw `ConvexError("Ride settings not configured")` if no document exists.

### Table: `otpSession`

Purpose: Temporary login OTP state keyed by phone number.

| Field         | Type     | Required | Default                  | Description                           | Relationship / Reference |
| ------------- | -------- | -------: | ------------------------ | ------------------------------------- | ------------------------ |
| `phoneNumber` | `string` |      Yes | None                     | Phone number OTP was sent to.         | None                     |
| `hashedOtp`   | `string` |      Yes | None                     | SHA-256 hash of generated OTP.        | None                     |
| `expiresAt`   | `number` |      Yes | `Date.now() + 5 minutes` | Expiration timestamp in milliseconds. | None                     |
| `attempts`    | `number` |      Yes | `0`                      | Incorrect attempt count.              | None                     |

Indexes:

| Name       | Fields        | Purpose                                             |
| ---------- | ------------- | --------------------------------------------------- |
| `by_phone` | `phoneNumber` | Upsert, lookup, delete, and increment OTP sessions. |

### Table: `session`

Purpose: Stores authenticated app sessions using random UUID tokens.

| Field          | Type         | Required | Default                         | Description                                                    | Relationship / Reference |
| -------------- | ------------ | -------: | ------------------------------- | -------------------------------------------------------------- | ------------------------ |
| `sessionToken` | `string`     |      Yes | Random UUID generated by action | Token passed to authenticated queries, mutations, and actions. | None                     |
| `userId`       | `Id<"user">` |      Yes | None                            | Authenticated user.                                            | References `user._id`    |
| `phoneNumber`  | `string`     |      Yes | None                            | Phone number associated with the session.                      | None                     |
| `expiresAt`    | `number`     |      Yes | `Date.now() + 365 days`         | Expiration timestamp in milliseconds.                          | None                     |

Indexes:

| Name              | Fields         | Purpose                             |
| ----------------- | -------------- | ----------------------------------- |
| `by_sessionToken` | `sessionToken` | Session validation and logout.      |
| `by_phone`        | `phoneNumber`  | Lookup sessions by phone if needed. |
| `by_userId`       | `userId`       | Lookup sessions by user if needed.  |

## Database Relationships

| Relationship                           | Cardinality / Behavior                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user` to `rider`                      | A user can have one rider profile. Enforced in mutations by checking `rider.by_user`.                                                                               |
| `user` to `driver`                     | A user can have one driver profile. Enforced in mutations by checking `driver.by_user`.                                                                             |
| `user` to `userPermission`             | A user can have multiple permission rows. Like a user can have permission as `driver` as well as `rider`                                                            |
| `organization` to `driver`             | One organization can have many drivers but one driver can be affiliated with only one organization.                                                                 |
| `organization` to `organizationsRate`  | One organization can have many rate rows. Each vehicle class has its own fare rules. Fare is calculated using these rows by vehicle class during fare calculations. |
| `driver` to `vehicle`                  | One driver can have only one vehicle. `addVehicle` enforces the constraint.                                                                                         |
| `rider` and `driver` to `ride`         | Each ride references one rider and one assigned driver. Histories are fetched by `ride.by_rider` and `ride.by_driver`.                                              |
| `ride` to `rideReasons`                | A ride can have only one cancellation/abort reason. Missing `driverId` means rider has cancelled/aborted the ride.                                                  |
| `ride`, `rider`, `driver` to `ratings` | A ride can have at most one rating per `raterType`.                                                                                                                 |
| `session` to `user`                    | Session validates to one user.                                                                                                                                      |

## Convex API Documentation

Procedure names below use their generated API path, for example `api.routes.rides.getDriverRide`.

### Authentication Model

The backend uses a custom `session` table for authentication.

- `authenticatedQuery` and `authenticatedMutation` add a required `sessionToken: string` argument, look up `session.by_sessionToken`, reject expired sessions, then expose `ctx.user` to the handler. Callers never pass `sessionToken` directly; the frontend `useAuthenticatedQuery` / `useAuthenticatedMutation` / `useAuthenticatedAction` hooks inject it automatically from the active session.
- Actions call `validateSession(ctx, sessionToken)`, which delegates to internal auth queries and returns `{ session, user }`.
- **Frontend hooks**: Both apps expose `useAuthenticatedQuery`, `useAuthenticatedMutation`, and `useAuthenticatedAction` in `hooks/customApi.ts`. These wrappers read the session token from `useAuth()` and append it to every call, so component code never manages the token manually.
- **Public endpoints** are limited to registration/onboarding flows (`addRider`, `addDriver`, OTP actions, `createSessionForUser`) and a small set of read-only organisation/discovery queries that are safe to expose without a session.

### Queries

| Procedure                                                | File                                          | Auth    | Arguments                                                                    | Returns                                                             | Reads                                                                             | Notes                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------- | ------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `routes.settings.rideSettings`                           | `packages/api/convex/routes/settings.ts`      | Session | `sessionToken`                                                               | First `rideSettings` doc                                            | `rideSettings`                                                                    | Returns `null` if settings are missing.                                                                    |
| `routes.organizations.getAllOrganizations`               | `packages/api/convex/routes/organizations.ts` | Public  | None                                                                         | `organization[]`                                                    | `organization`                                                                    | Used by registration/admin-style flows.                                                                    |
| `routes.organizations.getNearbyOrganization`             | `packages/api/convex/routes/organizations.ts` | Public  | `driverLocation: { latitude, longitude }`                                    | `organization[]`                                                    | `organization`                                                                    | Filters by optional bounding box and polygon; organizations without polygon are allowed.                   |
| `routes.organizations.getOrganizationById`               | `packages/api/convex/routes/organizations.ts` | Public  | `id: Id<"organization">`                                                     | Organization document or `null`                                     | `organization`                                                                    |                                                                                                            |
| `routes.organizations.getOrganizationRates`              | `packages/api/convex/routes/organizations.ts` | Public  | `organizationId`                                                             | `organizationsRate[]`                                               | `organizationsRate`                                                               | Uses `by_organization`.                                                                                    |
| `routes.organizations.getOrganizationRateById`           | `packages/api/convex/routes/organizations.ts` | Public  | `id`                                                                         | Organization-rate document or `null`                                | `organizationsRate`                                                               |                                                                                                            |
| `routes.organizations.getOrganizationRateByVehicleClass` | `packages/api/convex/routes/organizations.ts` | Public  | `organizationId`, `vehicleClass`                                             | First matching rate or `null`                                       | `organizationsRate`                                                               | Filters within `by_organization`.                                                                          |
| `routes.vehicle.getVehicleByDriverId`                    | `packages/api/convex/routes/vehicle.ts`       | Session | `sessionToken`, `driverId`                                                   | Vehicle with signed `rcImageKey` and `insuranceImageKey`, or `null` | `session`, `user`, `vehicle`                                                      | Calls S3 presigner for image keys.                                                                         |
| `routes.driver.getUser`                                  | `packages/api/convex/routes/driver.ts`        | Session | `sessionToken`                                                               | Authenticated user plus `driverDetails`                             | `session`, `user`, `driver`, `organization`, `ratings`                            | Returns signed profile/license URLs and driver average rating.                                             |
| `routes.driver.getDriver`                                | `packages/api/convex/routes/driver.ts`        | Public  | `id: Id<"driver">`                                                           | Driver plus `userDetails` and signed image URLs                     | `driver`, `user`                                                                  | Throws if driver missing.                                                                                  |
| `routes.driver.getDriverPaymentQrImage`                  | `packages/api/convex/routes/driver.ts`        | Session | `sessionToken`                                                               | Signed QR URL or `null`                                             | `session`, `user`, `driver`                                                       | Throws if driver missing.                                                                                  |
| `routes.rider.getRider`                                  | `packages/api/convex/routes/rider.ts`         | Session | `sessionToken`                                                               | Authenticated user plus `riderDetails`                              | `session`, `user`, `rider`                                                        | Returns signed profile URL in `profilePictureKey`.                                                         |
| `routes.rides.getRiderCurrentRideById`                   | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `id: Id<"ride">`                                             | Ride with rider, driver, vehicle, ratings, reasons                  | `session`, `ride`, `rider`, `driver`, `user`, `vehicle`, `ratings`, `rideReasons` | Exposes OTP only when status is `Driver Arrived`; throws if ride missing.                                  |
| `routes.rides.getDriverCurrentRideById`                  | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `id: Id<"ride">`                                             | Ride with rider, rider ratings, reasons                             | `session`, `ride`, `rider`, `user`, `ratings`, `rideReasons`                      | Throws if ride missing.                                                                                    |
| `routes.rides.getRiderCurrentRideByRiderId`              | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `riderId`                                                    | Current open/active/driver-arrived ride or `null`                   | `session`, `ride`, `rider`, `driver`, `user`, `vehicle`, `ratings`                | Filters rides with status `Driver Arrived`, `Open`, `Active`.                                              |
| `routes.rides.getRiderHistory`                           | `packages/api/convex/routes/rides.ts`         | Public  | `riderId`, optional `statuses` array of `Completed` or `Canceled` or `Abort` | Historical rides with driver details                                | `ride`, `rider`, `driver`, `user`, `ratings`                                      | Paginated query (fetches 8 rides per page). Default statuses include `Completed`, `Canceled`, and `Abort`. |
| `routes.rides.getDriverCurrentRideByDriverId`            | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `driverId`                                                   | Current accepted ride with rider details or `null`                  | `session`, `driver`, `ride`, `rider`, `user`, `ratings`                           | Fetches `Active` ride. Returns null if no `Active` ride is found.                                          |
| `routes.rides.getDriverRide`                             | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `id`                                                         | Ride details with rider, rider ratings, reasons, paymentQrCodeKey   | `session`, `user`, `driver`, `rider`, `ride`, `ratings`, `rideReasons`            | Returns `null` for driver sessions viewing rejected/no-response rides. OTP is removed from response.       |
| `routes.rides.getRiderRide`                              | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `id`                                                         | Rider-facing ride details with driver info                          | `session`, `user`, `ride`, `driver`, `ratings`, `rideReasons`                     |                                                                                                            |
| `routes.rides.getRideRequests`                           | `packages/api/convex/routes/rides.ts`         | Session | `sessionToken`, `driverId`                                                   | Pending open ride requests with rider details                       | `session`, `driver`, `ride`, `rider`, `user`, `ratings`                           | Used on driver home screen.                                                                                |
| `routes.rides.getDriverHistory`                          | `packages/api/convex/routes/rides.ts`         | Public  | `driverId`                                                                   | Completed/aborted rides with rider details                          | `driver`, `ride`, `rider`, `user`, `ratings`                                      | Paginated query (fetches 8 rides per page). Default statuses include Completed, and Abort.                 |
| `routes.rides.getRideToStart`                            | `packages/api/convex/routes/rides.ts`         | Public  | `id`, `driverId`                                                             | Ride or `null`                                                      | `ride`                                                                            | Returns ride only when driver matches, status is `Driver Arrived`, and request is accepted.                |
| `routes.rides.getRideRatings`                            | `packages/api/convex/routes/rides.ts`         | Public  | `rideId`                                                                     | `ratings[]`                                                         | `ratings`                                                                         | Fetches both driver and rider ratings for a ride.                                                          |
| `routes.rides.getDriverRatings`                          | `packages/api/convex/routes/rides.ts`         | Public  | `driverId`                                                                   | `{ ratings, average, total }`                                       | `driver`, `ratings`                                                               | Only rider-submitted ratings are included.                                                                 |
| `routes.rides.getRiderRatings`                           | `packages/api/convex/routes/rides.ts`         | Public  | `riderId`                                                                    | `{ ratings, average, total }`                                       | `rider`, `ratings`                                                                | Only driver-submitted ratings are included.                                                                |

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

Example query output on client

```javascript
{
  _id: "ride_id",
  status: "Active",
  requestStatus: "Accepted",
  driver: { _id: "driver_id", details: { firstName: "Asha" } },
  rider: { _id: "rider_id", details: { firstName: "Ravi" } },
  ratings: []
}
```

### Mutations

| Procedure                                         | File                      | Auth         | Arguments                                                                    | Returns                        | Writes / Side Effects                                                         | Errors / Edge Cases                                                                                                                |
| ------------------------------------------------- | ------------------------- | ------------ | ---------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `routes.auth.deleteSession`                       | `routes/auth.ts`          | Public token | `sessionToken`                                                               | `undefined`                    | Deletes matching `session` if present.                                        | No-op if token not found.                                                                                                          |
| `routes.rider.registerExpoPushToken`              | `routes/rider.ts`         | Session      | `sessionToken`, `expoPushToken`                                              | `undefined`                    | Patches rider push token.                                                     | No-op if rider missing.                                                                                                            |
| `routes.rider.logout`                             | `routes/rider.ts`         | Session      | `sessionToken`                                                               | `undefined`                    | Clears rider push token.                                                      | No-op if rider missing.                                                                                                            |
| `routes.rider.addRider`                           | `routes/rider.ts`         | Public       | User profile, optional `expoPushToken`                                       | `Id<"user">`                   | Inserts `user` if needed, inserts `rider`, inserts `userPermission`.          | Throws if rider already exists for phone or user creation fails.                                                                   |
| `routes.rider.registerAsRider`                    | `routes/rider.ts`         | Session      | `sessionToken`, optional `expoPushToken`                                     | `undefined`                    | Inserts rider and `userPermission`.                                           | Throws if rider profile already exists.                                                                                            |
| `routes.rider.updateRider`                        | `routes/rider.ts`         | Session      | `sessionToken`, `firstName`, optional `lastName`                             | `undefined`                    | Patches user name fields.                                                     | Throws if authenticated user has no rider.                                                                                         |
| `routes.rider.uploadProfilePicture`               | `routes/rider.ts`         | Session      | `sessionToken`, optional `profilePictureKey`                                 | `undefined`                    | Patches user profile picture key.                                             | Throws if not authenticated.                                                                                                       |
| `routes.rider.removeProfilePictureKey`            | `routes/rider.ts`         | Session      | `sessionToken`                                                               | `undefined`                    | Clears user profile picture key.                                              | Throws if not authenticated.                                                                                                       |
| `routes.rider.toggleGenderMatching`               | `routes/rider.ts`         | Session      | `sessionToken`                                                               | `undefined`                    | Toggles rider `genderMatching`.                                               | Throws if rider missing.                                                                                                           |
| `routes.driver.login`                             | `routes/driver.ts`        | Public       | `driverId`, `expoPushToken`                                                  | `undefined`                    | Sets push token and availability based on whether any ride exists for driver. | No-op if driver missing.                                                                                                           |
| `routes.driver.logout`                            | `routes/driver.ts`        | Session      | `sessionToken`                                                               | `undefined`                    | Sets driver offline/unavailable and clears push token.                        | No-op for invalid session or missing driver.                                                                                       |
| `routes.driver.addDriver`                         | `routes/driver.ts`        | Public       | User, license, organization, optional images/token                           | `Id<"user">`                   | Inserts user if needed, permission, and driver.                               | Throws duplicate driver, missing organization, or user creation failure.                                                           |
| `routes.driver.registerAsDriver`                  | `routes/driver.ts`        | Session      | `sessionToken`, license, organization, optional images/token                 | `undefined`                    | Inserts driver and permission row.                                            | Throws duplicate profile or missing organization. Inserts permission `"Driver"`.                                                   |
| `routes.driver.updateDriver`                      | `routes/driver.ts`        | Session      | `sessionToken`, names, license fields, `organizationId`                      | `undefined`                    | Patches user and driver license/org fields.                                   | Enforces organization license requirements and edit policy. Uses current driver organization for policy, not new `organizationId`. |
| `routes.driver.uploadProfilePicture`              | `routes/driver.ts`        | Session      | `sessionToken`, optional `profilePictureKey`                                 | `undefined`                    | Patches user profile picture key.                                             | Throws if not authenticated.                                                                                                       |
| `routes.driver.removeProfilePictureKey`           | `routes/driver.ts`        | Session      | `sessionToken`                                                               | `undefined`                    | Clears user profile picture key.                                              | None explicit beyond auth.                                                                                                         |
| `routes.driver.updatePaymentQrCode`               | `routes/driver.ts`        | Session      | `sessionToken`                                                               | `undefined`                    | Patches driver's payment QR key.                                              | Throws if driver missing.                                                                                                          |
| `routes.driver.updateLicense`                     | `routes/driver.ts`        | Session      | `sessionToken`, `number`, optional front/back keys                           | `undefined`                    | Patches license fields and verification state.                                | Enforces organization edit and verification policy.                                                                                |
| `routes.driver.toggleAvailability`                | `routes/driver.ts`        | Session      | `sessionToken`                                                               | `undefined`                    | Toggles `isOnline` and `isAvailableForRide`.                                  | Throws if driver missing or has pending/active rides while going offline.                                                          |
| `routes.driver.toggleGenderMatching`              | `routes/driver.ts`        | Session      | `sessionToken`                                                               | `undefined`                    | Toggles driver `genderMatching`.                                              | Throws if driver missing.                                                                                                          |
| `routes.vehicle.addVehicle`                       | `routes/vehicle.ts`       | Session      | `sessionToken`, vehicle fields, owner, optional image keys                   | `Id<"vehicle">`                | Inserts vehicle.                                                              | Validates capacity 2-50, driver/org existence, required images, duplicate registration, and one vehicle per driver.                |
| `routes.vehicle.updateVehicle`                    | `routes/vehicle.ts`       | Session      | `sessionToken`, vehicle id and full vehicle fields                           | `undefined`                    | Patches vehicle and verification/image fields.                                | Enforces organization edit and image requirements.                                                                                 |
| `routes.organizations.createOrganization`         | `routes/organizations.ts` | Session      | `sessionToken`, organization fields except polygon/bounding box              | `Id<"organization">`           | Inserts organization.                                                         | Cannot have two organizations with the same name.                                                                                  |
| `routes.organizations.updateOrganization`         | `routes/organizations.ts` | Session      | `sessionToken`, `id` plus optional editable fields                           | Updated organization or `null` | Patches provided fields.                                                      | Throws if organization not found.                                                                                                  |
| `routes.organizations.deleteOrganization`         | `routes/organizations.ts` | Session      | `sessionToken`, `id`                                                         | `{ success: true, id }`        | Deletes organization.                                                         | Throws if missing.                                                                                                                 |
| `routes.organizations.createOrganizationRate`     | `routes/organizations.ts` | Session      | `sessionToken`, rate fields                                                  | `Id<"organizationsRate">`      | Inserts rate.                                                                 | Verifies if same organization with same vehicle exists.                                                                            |
| `routes.organizations.updateOrganizationRate`     | `routes/organizations.ts` | Session      | `sessionToken`, `id` plus optional rate fields                               | Updated rate or `null`         | Patches provided fields.                                                      | Throws if missing.                                                                                                                 |
| `routes.organizations.deleteOrganizationRate`     | `routes/organizations.ts` | Session      | `sessionToken`, `id`                                                         | `{ success: true, id }`        | Deletes one rate.                                                             | Throws if missing.                                                                                                                 |
| `routes.organizations.deleteAllOrganizationRates` | `routes/organizations.ts` | Session      | `sessionToken`, `organizationId`                                             | `organizationsRate[]`          | Deletes all rates for the organization.                                       | Reads then deletes all matching rate documents.                                                                                    |
| `routes.rides.hasReachedDestination`              | `routes/rides.ts`         | Session      | `sessionToken`, `rideId`, `driverId`                                         | `undefined`                    | Sets `hasReachedDestination` to `true`.                                       | No-op unless ride is active and not already marked; throws if driver mismatch.                                                     |
| `routes.rides.submitRating`                       | `routes/rides.ts`         | Session      | `sessionToken`, `rideId`, `raterType`, `score`, optional `comment`           | `undefined`                    | Inserts rating.                                                               | Requires ownership. Score must be 1-5; ride must be `Completed` or `Abort`; one rating per ride/raterType.                         |
| `routes.rides.updateRating`                       | `routes/rides.ts`         | Session      | `sessionToken`, `ratingId`, `raterType`, `raterId`, optional `score/comment` | `undefined`                    | Patches rating.                                                               | Requires ownership, same rater type, score 1-5, and creation within 24 hours.                                                      |

Example mutation input:

```json
{
  "rideId": "ride_id",
  "raterType": "Rider",
  "score": 5,
  "comment": "Clean vehicle and smooth trip"
}
```

Example mutation input on client:

```javascript
{
  rideId: "ride_id",
  raterType: "Rider",
  score: 5,
  comment: "Clean vehicle and smooth trip"
}
```

Example mutation output:

```json
null
```

Convex JavaScript clients receive `undefined` for mutations that do not explicitly return a value.

### Actions

| Procedure                                       | File                       | Auth    | Arguments                                                                                  | Returns                                                                                                                          | Reads / Writes                                                                                          | External services                              | Side effects and edge cases                                                                                                                        |
| ----------------------------------------------- | -------------------------- | ------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions.auth.sendOtp`                          | `actions/auth.ts`          | Public  | `phoneNumber`                                                                              | `{ success: true }`                                                                                                              | Upserts `otpSession`                                                                                    | SMS gateway via `SMS_URL` and `SMS_LICENSE`    | Generates 6-digit OTP, stores SHA-256 hash, sends SMS. Throws if env missing or SMS response is not OK.                                            |
| `actions.auth.verifyOtp`                        | `actions/auth.ts`          | Public  | `phoneNumber`, `otp`                                                                       | Existing user: `{ userExists: true, sessionToken, userId }`; new user: `{ userExists: false, sessionToken: null, userId: null }` | Reads/deletes/increments `otpSession`; reads `user`; inserts `session` for existing user                | None                                           | Deletes expired/successful OTP sessions.                                                                                                           |
| `actions.auth.createSessionForUser`             | `actions/auth.ts`          | Public  | `userId`, `phoneNumber`                                                                    | `{ sessionToken }`                                                                                                               | Inserts `session`                                                                                       | None                                           | Used after registration to create a session for a newly registered user.                                                                           |
| `actions.upload.getPresignedUrl`                | `actions/upload.ts`        | Session | `sessionToken`, `key`, `contentType`                                                       | `{ url, key }`                                                                                                                   | Reads `session`, `user`                                                                                 | S3/MinIO presigner                             | Generates a PUT presigned URL expiring in 5 minutes.                                                                                               |
| `actions.nearbyDrivers.getNearbyDrivers`        | `actions/nearbyDrivers.ts` | Session | `sessionToken`, pickup/destination coords, `riderId`, `distance`, `genderMatch`, `filters` | Nearby driver result array                                                                                                       | Reads `rideSettings`, then internal ride/driver/vehicle/rating/rate data                                | Ably REST presence endpoint                    | Fetches live driver coordinates from Ably, filters by radius, calls internal query for DB enrichment. Returns `[]` on many failures after logging. |
| `actions.ride.bookRide`                         | `actions/ride.ts`          | Session | `sessionToken`, rider, driver, fare, pickup, destination, distance, optional duration      | `Id<"ride">`                                                                                                                     | Inserts `ride`; schedules no-response mutation (executes `settings.driverResponseTime` or `10 minutes`) | Expo push                                      | Notifies driver of new request if token exists.                                                                                                    |
| `actions.ride.acceptRideAction`                 | `actions/ride.ts`          | Session | `sessionToken`, `driverId`, `rideId`                                                       | `undefined`                                                                                                                      | Patches ride/driver and other pending requests                                                          | Expo push                                      | Notifies rider that ride was accepted.                                                                                                             |
| `actions.ride.changeDriver`                     | `actions/ride.ts`          | Session | `sessionToken`, `rideId`, `riderId`, `driverId`                                            | `undefined`                                                                                                                      | Patches ride assigned driver; may release old driver                                                    | Expo push                                      | Notifies previous driver only if ride had `requestStatus === "Accepted"` before change. Notifies new driver about new ride request.                |
| `actions.ride.cancelRide`                       | `actions/ride.ts`          | Session | `sessionToken`, `riderId`, `rideId`                                                        | `undefined`                                                                                                                      | Patches ride canceled; may release driver                                                               | Expo push                                      | Rider cancel without reason. Use `riderCancelRide` for reason and active abort.                                                                    |
| `actions.ride.calculateRiderCancelRideCharges`  | `actions/ride.ts`          | Session | `sessionToken`, `rideId`, `driverLocation`                                                 | Fare breakdown                                                                                                                   | Reads ride, organization rate, settings                                                                 | Google Directions                              | Computes rider cancellation/abort fare and penalty based on covered distance.                                                                      |
| `actions.ride.riderCancelRide`                  | `actions/ride.ts`          | Session | `sessionToken`, `rideId`, `riderId`, `reason`, optional `driverLocation`                   | `undefined`                                                                                                                      | Patches ride, inserts reason, may release driver                                                        | Google Directions, Google Geocoding, Expo push | Active rides become `Abort` with recalculated fare; other allowed stages become `Canceled`. Requires location for active rides.                    |
| `actions.ride.calculateDriverCancelRideCharges` | `actions/ride.ts`          | Session | `sessionToken`, `id`, `driverLocation`                                                     | Fare breakdown                                                                                                                   | Reads ride, organization rate, settings                                                                 | Google Directions                              | Computes driver-side abort fare based on covered distance after arrival radius threshold.                                                          |
| `actions.ride.driverCancelRide`                 | `actions/ride.ts`          | Session | `sessionToken`, `rideId`, `driverId`, `reason`, `driverLocation`                           | `undefined`                                                                                                                      | Patches ride, inserts reason, releases driver                                                           | Google Directions, Google Geocoding, Expo push | Active rides become `Abort`; non-active rides are marked `Open` with `requestStatus: "Rejected"`.                                                  |
| `actions.ride.rejectRide`                       | `actions/ride.ts`          | Session | `sessionToken`, `driverId`, `rideId`                                                       | `undefined`                                                                                                                      | Patches ride request as rejected                                                                        | Expo push                                      | Notifies rider that request was declined.                                                                                                          |
| `actions.ride.driverArrived`                    | `actions/ride.ts`          | Session | `sessionToken`, `rideId`, `driverId`                                                       | `undefined`                                                                                                                      | Patches ride status, arrival time, OTP                                                                  | Expo push                                      | Generates 4-digit ride OTP and notifies rider.                                                                                                     |
| `actions.ride.generateRideOtp`                  | `actions/ride.ts`          | Session | `sessionToken`, `rideId`                                                                   | `undefined`                                                                                                                      | Patches ride OTP                                                                                        | Expo push                                      | Generates replacement 4-digit OTP and notifies rider.                                                                                              |
| `actions.ride.startRide`                        | `actions/ride.ts`          | Session | `sessionToken`, `driverId`, `rideId`, `otp`                                                | `undefined`                                                                                                                      | Patches ride active/start time                                                                          | Expo push                                      | Validates OTP and status before starting ride.                                                                                                     |
| `actions.ride.completeRide`                     | `actions/ride.ts`          | Session | `sessionToken`, `driverId`, `rideId`, `driverLocation`                                     | `undefined`                                                                                                                      | Patches ride completed/fare/distance/dropoff, releases driver                                           | Google Directions, Google Geocoding, Expo push | Requires `hasReachedDestination` to be true in internal mutation. Adds extra distance/fare if driver location is outside arrival radius.           |

Example action input:

```json
{
  "sessionToken": "session-uuid",
  "riderId": "rider_id",
  "driverId": "driver_id",
  "fare": 120,
  "pickup": {
    "address": "Hostel 1",
    "latitude": 19.1334,
    "longitude": 72.9133
  },
  "destination": {
    "address": "Main Gate",
    "latitude": 19.13,
    "longitude": 72.918
  },
  "distance": 1800,
  "expectedDuration": "8 mins"
}
```

Example action input on client:

```javascript
{
  sessionToken: "session-uuid",
  riderId: "rider_id",
  driverId: "driver_id",
  fare: 120,
  pickup: {
    address: "Hostel 1",
    latitude: 19.1334,
    longitude: 72.9133
  },
  destination: {
    address: "Main Gate",
    latitude: 19.13,
    longitude: 72.918
  },
  distance: 1800,
  expectedDuration: "8 mins"
}
```

Example action output:

```json
"ride_id"
```

### Internal Queries and Mutations

Internal procedures are callable only from Convex functions/actions, not directly by frontend clients.

| Procedure                                           | Type              | File                      | Purpose                                                                                     | Reads                                                                                                        | Writes / Returns                                                                                                     |
| --------------------------------------------------- | ----------------- | ------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `routes.auth.upsertOtpSession`                      | Internal mutation | `routes/auth.ts`          | Create or replace OTP hash and expiration for a phone number.                               | `otpSession`                                                                                                 | Inserts or patches `otpSession`.                                                                                     |
| `routes.auth.getOtpSession`                         | Internal query    | `routes/auth.ts`          | Fetch OTP session by phone.                                                                 | `otpSession`                                                                                                 | Returns session or `null`.                                                                                           |
| `routes.auth.deleteOtpSession`                      | Internal mutation | `routes/auth.ts`          | Delete OTP session by phone.                                                                | `otpSession`                                                                                                 | Deletes if present.                                                                                                  |
| `routes.auth.incrementAttempts`                     | Internal mutation | `routes/auth.ts`          | Track incorrect OTP attempt.                                                                | `otpSession`                                                                                                 | Patches attempts or deletes session at max attempts.                                                                 |
| `routes.auth.createSession`                         | Internal mutation | `routes/auth.ts`          | Create app session.                                                                         | None                                                                                                         | Inserts `session`, returns token.                                                                                    |
| `routes.auth.getSessionByToken`                     | Internal query    | `routes/auth.ts`          | Validate token and expiration.                                                              | `session`                                                                                                    | Returns valid session or `null`.                                                                                     |
| `routes.auth.getUserByPhone`                        | Internal query    | `routes/auth.ts`          | Lookup user by phone.                                                                       | `user`                                                                                                       | Returns user or `null`.                                                                                              |
| `routes.auth.getUserByIdInternal`                   | Internal query    | `routes/auth.ts`          | Lookup user by id.                                                                          | `user`                                                                                                       | Returns user or `null`.                                                                                              |
| `routes.settings.rideSettingsInternal`              | Internal query    | `routes/settings.ts`      | Fetch global ride settings.                                                                 | `rideSettings`                                                                                               | Returns settings or null.                                                                                            |
| `routes.driver.getDriverInternal`                   | Internal query    | `routes/driver.ts`        | Fetch driver with vehicle for actions.                                                      | `driver`, `vehicle`                                                                                          | Returns `{ ...driver, vehicle }` or throws.                                                                          |
| `routes.organizations.getOrganizationRatesInternal` | Internal query    | `routes/organizations.ts` | Fetch organization rates for actions.                                                       | `organizationsRate`                                                                                          | Returns rate array.                                                                                                  |
| `routes.rides.getNearbyDriversQueryResultInternal`  | Internal query    | `routes/rides.ts`         | Enrich Ably presence driver data with DB profile, vehicle, ratings, organization, and fare. | `rider`, `user`, `rideSettings`, `driver`, `ride`, `vehicle`, `ratings`, `organization`, `organizationsRate` | Returns nearby-driver result array.                                                                                  |
| `routes.rides.bookRideInternal`                     | Internal mutation | `routes/rides.ts`         | Validate rider/driver and create pending ride request.                                      | `rider`, `driver`, `ride`, `rideSettings`                                                                    | Inserts `ride`, schedules no-response job, returns ride id and driver push token.                                    |
| `routes.rides.markNoResponseInternal`               | Internal mutation | `routes/rides.ts`         | Mark pending ride request as no response after timeout.                                     | `ride`, `rider`                                                                                              | Patches `ride.requestStatus`.                                                                                        |
| `routes.rides.changeDriverInternal`                 | Internal mutation | `routes/rides.ts`         | Reassign an existing ride to a new driver.                                                  | `ride`, `driver`, `rideSettings`                                                                             | Patches old driver, ride driver/request status, schedules no-response job.                                           |
| `routes.rides.cancelRideInternal`                   | Internal mutation | `routes/rides.ts`         | Rider cancellation for open/arrived rides.                                                  | `rider`, `ride`, `driver`                                                                                    | Patches ride canceled, inserts optional reason, may release driver, returns driver push token.                       |
| `routes.rides.riderAbortRideInternal`               | Internal mutation | `routes/rides.ts`         | Rider abort of active ride after fare recalculation.                                        | `rider`, `ride`, `driver`                                                                                    | Patches ride abort fields, inserts reason, releases driver, returns driver push token.                               |
| `routes.rides.driverCancelRideInternal`             | Internal mutation | `routes/rides.ts`         | Driver rejection/cancellation/abort.                                                        | `driver`, `ride`, `rider`                                                                                    | Patches ride, inserts reason, releases driver, returns rider push token.                                             |
| `routes.rides.getDetailsInternal`                   | Internal query    | `routes/rides.ts`         | Fetch ride by id for actions.                                                               | `ride`                                                                                                       | Returns ride or throws.                                                                                              |
| `routes.rides.rideOrganizationRateInternal`         | Internal query    | `routes/rides.ts`         | Fetch ride plus matching organization rate.                                                 | `ride`, `driver`, `vehicle`, `organization`, `organizationsRate`                                             | Returns `{ organizationRate, ride }` or throws.                                                                      |
| `routes.rides.rejectRideInternal`                   | Internal mutation | `routes/rides.ts`         | Driver rejects a pending ride request.                                                      | `driver`, `ride`, `rider`                                                                                    | Patches request rejected, returns rider push token.                                                                  |
| `routes.rides.acceptRideInternal`                   | Internal mutation | `routes/rides.ts`         | Driver accepts a ride request.                                                              | `driver`, `ride`, `rider`                                                                                    | Patches ride accepted, marks other pending requests no-response, marks driver unavailable, returns rider push token. |
| `routes.rides.driverArrivedInternal`                | Internal mutation | `routes/rides.ts`         | Mark driver arrived and store ride OTP.                                                     | `ride`, `rider`                                                                                              | Patches ride status/OTP/arrival time, returns rider push token.                                                      |
| `routes.rides.generateRideOtpInternal`              | Internal mutation | `routes/rides.ts`         | Replace ride OTP.                                                                           | `ride`, `rider`                                                                                              | Patches ride OTP, returns rider push token.                                                                          |
| `routes.rides.startRideInternal`                    | Internal mutation | `routes/rides.ts`         | Validate OTP and start ride.                                                                | `driver`, `ride`, `rider`                                                                                    | Patches ride active/start time, returns rider push token.                                                            |
| `routes.rides.completeRideInternal`                 | Internal mutation | `routes/rides.ts`         | Complete active ride after destination reached.                                             | `driver`, `ride`, `rider`                                                                                    | Patches ride completed/fare/distance/dropoff, marks driver available, returns rider push token.                      |

## Ride Lifecycle Summary

| Step                       | Procedure                                                       | Main state changes                                                                                                         |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Discover drivers           | `actions.nearbyDrivers.getNearbyDrivers`                        | Reads Ably live locations, filters drivers, computes estimated fare.                                                       |
| Book ride                  | `actions.ride.bookRide` -> `bookRideInternal`                   | Inserts `ride` as `status: "Open"`, `requestStatus: "Pending"` and schedules timeout.                                      |
| Accept request             | `actions.ride.acceptRideAction` -> `acceptRideInternal`         | Sets `requestStatus: "Accepted"`, stores `acceptedAt`, marks driver unavailable, marks other pending requests no-response. |
| Reject/no response         | `actions.ride.rejectRide` or scheduled `markNoResponseInternal` | Sets `requestStatus` to `Rejected` or `No Response`.                                                                       |
| Driver arrived             | `actions.ride.driverArrived` -> `driverArrivedInternal`         | Generates OTP, sets `status: "Driver Arrived"`, stores `arrivedAt`.                                                        |
| Start ride                 | `actions.ride.startRide` -> `startRideInternal`                 | Verifies OTP, sets `status: "Active"`, stores `startedAt`.                                                                 |
| Reached destination        | `routes.rides.hasReachedDestination`                            | Sets `hasReachedDestination: true`.                                                                                        |
| Complete ride              | `actions.ride.completeRide` -> `completeRideInternal`           | Sets `status: "Completed"`, stores final fare/distance/dropoff, marks driver available.                                    |
| Rider cancel/abort         | `actions.ride.riderCancelRide`                                  | Non-active rides become `Canceled`; active rides become `Abort` with recalculated fare and reason.                         |
| Driver reject/cancel/abort | `actions.ride.driverCancelRide`                                 | Active rides become `Abort`; non-active requests become `Open` with `requestStatus: "Rejected"`.                           |

## External Integrations

| Integration                 | Configuration                                                                      | Used by                                                   | Behavior                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| SMS gateway                 | `SMS_URL`, `SMS_LICENSE`                                                           | `actions.auth.sendOtp`                                    | Sends registration/login OTP SMS.                                                             |
| MinIO/S3-compatible storage | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ENDPOINT`, `MINIO_BUCKET`           | Upload action and signed image URL queries                | Generates signed PUT/GET URLs for profile, license, RC, insurance, and payment QR image keys. |
| Ably                        | `ABLY_API_KEY` or `EXPO_PUBLIC_ABLY_API_KEY`; `ABLY_URL` or `EXPO_PUBLIC_ABLY_URL` | `actions.nearbyDrivers.getNearbyDrivers`                  | Reads live presence data containing driver coordinates and driver ids.                        |
| Google Maps Directions API  | `GOOGLE_MAPS_API_KEY`                                                              | Fare calculation and ride completion/cancellation actions | Computes remaining distance/duration from current driver location to destination.             |
| Google Maps Geocoding API   | `GOOGLE_MAPS_API_KEY`                                                              | Active ride abort/completion drop-off handling            | Converts driver coordinates to a short address.                                               |
| Expo Push Notifications     | Optional `EXPO_ACCESS_TOKEN`                                                       | Ride actions                                              | Sends push notifications to rider/driver Expo tokens. Invalid token formats are skipped.      |

## Authorization Notes For Frontend Developers

### Session Token Injection

Nearly all protected queries, mutations, and actions now require `sessionToken`. Frontend code should **never pass `sessionToken` manually**. Both apps expose custom hooks in `hooks/customApi.ts` that inject it automatically:

| Hook                       | Replaces      | Use for             |
| -------------------------- | ------------- | ------------------- |
| `useAuthenticatedQuery`    | `useQuery`    | Protected queries   |
| `useAuthenticatedMutation` | `useMutation` | Protected mutations |
| `useAuthenticatedAction`   | `useAction`   | Protected actions   |

### What Remains Public

The following endpoints intentionally have no session requirement because they execute before a session exists:

- **OTP flow**: `actions.auth.sendOtp`, `actions.auth.verifyOtp`, `actions.auth.createSessionForUser`
- **Initial registration**: `routes.rider.addRider`, `routes.driver.addDriver` (first-time sign-up from OTP flow)
<!-- - **Session deletion**: `routes.auth.deleteSession` (logout mutation accepts a raw token, not a session context) -->
- **Driver login push-token refresh**: `routes.driver.login` (called after app reopens, before guard context is available)
- **Public read-only organisation queries**: `getAllOrganizations`, `getNearbyOrganization`, `getOrganizationById`, `getOrganizationRates`, `getOrganizationRateById`, `getOrganizationRateByVehicleClass`
  <!-- - **Public read-only driver info**: `routes.driver.getDriver` -->
  <!-- - **Historical ride queries**: `getRiderHistory`, `getDriverHistory`, `getRideToStart`, `getRideRatings`, `getDriverRatings`, `getRiderRatings` -->

### Key Behaviour Notes

- Session-protected wrappers (`authenticatedQuery`, `authenticatedMutation`) strip `sessionToken` from the args before passing them to the handler and expose the resolved `ctx.user` object instead.
- Actions use `validateSession(ctx, args.sessionToken)` directly and receive `{ session, user }` in return.
- Driver/rider registration can reuse an existing `user` document if the phone number exists and the specific profile type does not already exist.
- Image fields have different meanings in responses vs storage. In stored documents they are object storage keys; in most query responses the same field name contains a short-lived pre-signed URL.
- Convex `Id<"...">` values are opaque strings on the frontend. Use ids returned by queries/mutations rather than constructing them.
