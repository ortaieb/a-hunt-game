# Scavenger-Hunt Game - User Management

## Feature:
Build a user management feature for

### USERS table
Users should be stored in a temporal table, to allow changes to the profile.
Following details will be stored for user account:

- **user_id**: sequence - unique id of the record
- **username**: text - an email address formatted.
- **password**: obfuscated text - password of the user
- **nickname**: text - name the user will use in the game (and challenges, unless replaced in the challenge details)
- **roles**: text -

#### Indices and Constraints
- Primary Key: user_id
- constraints:
  - unique(username + valid_until) will guaranty we can locate fast the active record

### API

1. Create new User:
   Request:
   ```
   POST /hunt/users
   headers:
     - user-auth-token: <token with `game.admin` role>
   payload:
    {
      "username": <username>,
      "password": <cleartext password>,
      "nickname": <name for the game>,
      "rolse": <set of roles>
    }
    ```

    Outcome:
    ```
    200 OK

    {
      "user-id": <user id>,
      "username": <username>
    }
    ```

    or

    | Case                    |  Status Code  | Error Message                        |
    |-------------------------|---------------|--------------------------------------|
    | no auth-token header    | 401           | request did not include token        |
    | corrupted or user token | 401           | request carries the wrong token      |
    | failed to add user      | 403           | reason for failure                   |

2. Delete existing user
   Request:
   ```
   DELETE /hunt/users/<username>
   headers:
     - user-auth-token: <token with `game.admin` role>
   ```

   Outcome:
   ```
   200 OK
   ```

   or

    | Case                    |  Status Code  | Error Message                        |
    |-------------------------|---------------|--------------------------------------|
    | no auth-token header    | 401           | request did not include token        |
    | corrupted or user token | 401           | request carries the wrong token      |
    | failed to delete user   | 403           | reason for failure                   |

3. Update existing User
   This requires a new replacement record to be provided
   Request:
   ```
   PUT /hunt/users/<username>
   headers:
     - user-auth-token: <token with `game.admin` role>
   payload:
    {
      "username": <username>,
      "password": <cleartext password - new version>,
      "nickname": <name for the game - new version>,
      "rolse": <set of roles - new version>
    }
   ```

   Outcome:
   ```
   200 OK
   {
      "user-id": <user id>,
      "username": <username>
   }
   ```

   or

    | Case                    |  Status Code  | Error Message                        |
    |-------------------------|---------------|--------------------------------------|
    | no auth-token header    | 401           | request did not include token        |
    | corrupted or user token | 401           | request carries the wrong token      |
    | failed to update user   | 403           | reason for failure                   |
    | no change required      | 400           | reason for failure                   |

#### API Constraints
Initially, user-management endpoint action will require an `game.admin` role.


## Defaults
A default admin user shouldbe created (for development stages).
Create user with the following details:
{
  "username": "admin@local.domain",
  "password": "Password1!",
  "nickname": "admin",
  "rolse": ["game.admin"]
}


## Additional material

- Use `docs/plans/00-gameplay.md` for game overview and expectations.
- Consult `docs/plans/WoW/wow01-rdbs.md` for more details about database design.
