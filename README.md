# Cloud-Computing-Final
2025 Spring

# 0.
cd trip-planner-notifications

# 1. Lambda #1: WriteAbnormalData
cd write_weather_report
zip -r ../write_weather_report.zip app.py requirements.txt
cd ..

# 2. Lambda #2: FetchAndEmail
cd fetch_and_email
zip -r ../fetch_and_email.zip app.py requirements.txt
cd ..

# 3. Lambda #3: WriteAbnormalData
cd write_abnormal_data_flight
zip -r ../write_abnormal_data_flight.zip app.py requirements.txt
cd ..

# 4. Lambda #4: FetchAndEmail
cd fetch_and_email_flight
zip -r ../fetch_and_email_flight.zip app.py requirements.txt
cd ..

# 5. if bucket not yet created
aws s3 mb s3://trip-planner-artifacts-cc --region us-east-2

# 6. Lambdas upload to S3
aws s3 cp write_weather_report.zip s3://trip-planner-artifacts-cc/
aws s3 cp fetch_and_email.zip    s3://trip-planner-artifacts-cc/
aws s3 cp write_abnormal_data_flight.zip s3://trip-planner-artifacts-cc/
aws s3 cp fetch_and_email_flight.zip    s3://trip-planner-artifacts-cc/

# 7. Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name trip-planner-notifications \
  --region us-east-2 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      S3BucketForCode=trip-planner-artifacts-cc \
      SenderEmail=chelseacdx@gmail.com \
      DBHostParameter=database-1.czosuqseg7y8.us-east-2.rds.amazonaws.com \
      DBUserParameter=admin \
      DBPasswordParameter=admin2025cc \
      DBNameParameter=Trip_Planner

# 8. Grab SQS queue URL into a shell variable
QURL=$(aws sqs get-queue-url \
  --queue-name abnormal-data-queue \
  --region us-east-2 \
  --query 'QueueUrl' --output text)
echo "QueueUrl="$QURL

# 9. Invoke WriteWeatherReport
aws lambda invoke \
  --function-name WriteWeatherReport \
  --payload '{}' \
  write-output.json \
  --region us-east-2 \
  --log-type Tail \
  --query 'LogResult' --output text | base64 -d

# 10. Inspect what’s now on the queue
aws sqs receive-message \
  --queue-url "$QURL" \
  --max-number-of-messages 10 \
  --visibility-timeout 0 \
  --wait-time-seconds 0 \
  --output json

# 11. Invoke FetchAndEmail to drain & email
aws lambda invoke \
  --function-name FetchAndEmail \
  --payload '{}' \
  email-output.json \
  --region us-east-2 \
  --log-type Tail \
  --query 'LogResult' --output text | base64 -d

# 12. Verify the queue is now empty
aws sqs receive-message \
  --queue-url "$QURL" \
  --max-number-of-messages 10 \
  --visibility-timeout 0 \
  --wait-time-seconds 0 \
  --output json

# 13. Invoke WriteAbnormalDataFlight
aws lambda invoke \
  --function-name WriteAbnormalDataFlight \
  --payload '{}' \
  write-output.json \
  --region us-east-2 \
  --log-type Tail \
  --query 'LogResult' --output text | base64 -d

# 14. Inspect what’s now on the queue
aws sqs receive-message \
  --queue-url "$QURL" \
  --max-number-of-messages 10 \
  --visibility-timeout 0 \
  --wait-time-seconds 0 \
  --output json

# 15. Invoke FetchAndEmailFlight to drain & email
aws lambda invoke \
  --function-name FetchAndEmailFlight \
  --payload '{}' \
  email-output.json \
  --region us-east-2 \
  --log-type Tail \
  --query 'LogResult' --output text | base64 -d

# 16. Verify the queue is now empty
aws sqs receive-message \
  --queue-url "$QURL" \
  --max-number-of-messages 10 \
  --visibility-timeout 0 \
  --wait-time-seconds 0 \
  --output json

  # 17. Tail CloudWatch Logs and check email