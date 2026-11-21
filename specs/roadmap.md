[x] complete ui redesign including styles for themes.
[x] remove any mention of family or the need to support other users with access to the data.
[x] import balance and display it for the account.
[] update constitution to make sure the seed.sql is updated when database migrations are created.
[] support creating a budget via categories.
[] support proper identity provider such as entraid, google and facebook.
[] on transaction import support selecting/deselecting so not all transactions are imported.
[] on transaction import turn in to a wizard so that category view can be reviewed on a different screen.
[] allow the edit and deletion of individual transaction after they have been imported.
[] use ai to help build out a category rule engine.  ai may not be the best fit for identifying category mapping at runtime.
[] determine the best way to protect data.  master key in keyvault, but what about family specific data encryption key.  database feels a better location for that.  is it best practice?
[] what do i need to do to be compliant with regulations and best practice for storing transaction data?
[] are there any awards i can get that are low barriers of entry.  e.g. dont need many or any customers to win.
[] do i need to put the transaction import off to a background process or thread?  especially when categorization is part of the import.
[x] make sure Title Case rule has been retrofitted.
[x] make sure the constitution recognises % and $ inputs and proper validation occurs
[x] address the poor ux for the delete confirmation in categories
[] on the mortgages page it currently asks for first payment date.  but it should be load start date.
[] need to have resiliance in the front end if the server is not available
[] need to have resiliance on the server if the database is not available