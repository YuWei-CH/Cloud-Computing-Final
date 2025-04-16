# Create a user pool that requires email verification
aws cognito-idp create-user-pool --cli-input-json file://create-user-pool.json

# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --client-name MyFrontendAppClient

# Confirm using email
aws cognito-idp create-user-pool-domain \
  --domain <YOUR_CUSTOM_DOMAIN>\
  --user-pool-id <YOUR_USER_POOL_ID>

# Basic password policy
aws cognito-idp update-user-pool --user-pool-id <YOUR_USER_POOL_ID> --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":false,"RequireLowercase":false,"RequireNumbers":false,"RequireSymbols":false}}'