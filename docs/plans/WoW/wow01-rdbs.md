# Relational Database guidelines

When involvement of database \ store of data is required for the task make sure you receive fully detailed requirements for the use.
This include primary keys, indices, contraints and types of columns, when not inferred from the model or from the use.


## Types of Tables
The data placed in the database will be used for audit purpose. For this reason, business data in records inserted will not be changed.
There will be two types of tables:
- immutable table
- temporal table

### Immutable Tables
Storing data for later aggregation with no ability (from application side) to alter the content of the records. This will include activity_log, participant_location etc.
These tables will require the creator to specify the indices and foreign keys to be applied on the table.

### Temporal Talbes
Temporal tables will store data to allow changes to be made. Each table will have two additional datetime coloumns representing the time of insertion of the
record (`valid_from`) and the time the record is no longer valid(`valid_until`).

Temporal tables will generate a primary key based in sequences, unless specified otherwise (like, id as UUID).

1. Insert record
   Every creation of new record will leave the `valid_until` column as null.
2. Delete record
   Update `valid_until` to _CURRENT_TIMESTAMP()_ in the record with the business identifier (e.g. username in USERS table, where index applied on username)
   and `valid_until` is null.
3. Update record
   combine the two operations (Insert and Delete). Where current record is _deleted_ and the new version is _inserted_.

To guarantee no data loss, all activities must be executed inside a transaction.


## Transaction Management
Any changes to data should be run under transaction. Assumption is the RDBS will provide its one implementation of transaction and the codebase will only include SQL standard
start and commit/rollback using interface.
