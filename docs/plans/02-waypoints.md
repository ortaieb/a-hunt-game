# Planned Waypoints

Waypoints are the core of the challenges. We can reuse waypoint sequence for different challenges (played by
different people).


## Waypoint Structure

### Waypoint

Each waypoint should include the following properties:

- **waypoint_seq_id: number**: a number representing the position of the waypoint in the sequece.
- **location: GeoLocation**: target of the waypoint
- **radius:number**: tolerance radius around the location
- **clue: text**: description of the waypoint location to be presented to the participant
- **hints: seq[text]**: list of hints to be offered to the participant
- **image_subject:text**: what will the image sent as a prove of attendance should look like?

### GeoLication

A tuple representing latitude/longitude of a point. Both value should support floating point representation of decimals:
- **lat: number**: latitude value
- **long: number**: longitude value


## DB Model

Waypoints are not standing alone and will always have value as a sequence. Therefore, no value in storing each waypoint as
a standalone record. Instead, the database Waypoints table will store each sequence as a json field. When a `Sequence of Waypoints` will be used the whole sequence will be loaded to the _Challenge Manager_ and managed there.

Waypoints Sequnce should be stored in a temporal table `Waypoints` with the additional details:
- **waypoints_id: sequence**
- **waypoint_name: text**: name of the waypoint
- **waypoint_description: text**: description of the waypoint
- **data: json**: jspon representation of the sequence of waypoints

### Indices and Constraints
- Primary key: waypoints_id
- constraints:
  - unique(waypoint_name + valid_until) will guaranty we can locate fast the active record


## API

API will include rest endpoints allowing _crud_ access. Use rest conventions for easy integration.

1. get - retrives back current version of the record
2. post - insert new waypoints entry
3. put - update existing waypoints entry. this requires a full new version to be provided
4. delete - delete existing waypoints entry

- All endpoints should use prefix `/hunt/manager/waypoints
- A `game.admin` permission is required for the managing waypoints - this means request should come with a valud _user-auth-token_ presenting game.admin role.


## Additional material

- Use `docs/plans/00-gameplay.md` for game overview and expectations.
- Consult `docs/plans/WoW/wow01-rdbs.md` for more details about database design.
- 