PACKAGE_DIRS = write_abnormal_data fetch_and_email

package:
	@for d in $(PACKAGE_DIRS); do \
	  cd $$d && pip install -r requirements.txt -t . && \
	  zip -r ../$$d.zip . && cd .. ;\
	done

upload: package
	aws s3 cp write_abnormal_data.zip s3://$(S3BucketForCode)/ --profile trip-planner
	aws s3 cp fetch_and_email.zip   s3://$(S3BucketForCode)/ --profile trip-planner

validate:
	aws cloudformation validate-template \
	  --template-body file://template.yaml \
	  --profile trip-planner

deploy: upload validate
	aws cloudformation deploy \
	  --template-file template.yaml \
	  --stack-name trip-planner-notifications \
	  --parameter-overrides \
	    S3BucketForCode=$(S3BucketForCode) \
	    SenderEmail=$(SenderEmail) \
	    DBHostParameter=$(DBHostParameter) \
	    DBUserParameter=$(DBUserParameter) \
	    DBPasswordParameter=$(DBPasswordParameter) \
	    DBNameParameter=$(DBNameParameter) \
	  --capabilities CAPABILITY_NAMED_IAM \
	  --profile trip-planner

test:
	pytest -q
