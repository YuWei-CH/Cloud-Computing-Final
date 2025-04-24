package:
	cd write_abnormal_data && pip install -r requirements.txt -t . && zip -r ../write_abnormal_data.zip . && cd ..
	cd fetch_and_email   && pip install -r requirements.txt -t . && zip -r ../fetch_and_email.zip   . && cd ..

upload: package
	aws s3 cp write_abnormal_data.zip s3://trip-planner-artifacts-cc/ --profile trip-planner
	aws s3 cp fetch_and_email.zip   s3://trip-planner-artifacts-cc/ --profile trip-planner

deploy: upload
	aws cloudformation deploy \
	  --template-file template.yaml \
	  --stack-name trip-planner-notifications \
	  --profile trip-planner \
	  --capabilities CAPABILITY_NAMED_IAM \
	  --parameter-overrides \
	     S3BucketForCode=trip-planner-artifacts-cc \
	     SenderEmail=dc4806@nyu.edu
