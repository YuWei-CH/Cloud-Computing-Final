aws s3 mb s3://<your-S3-name>

aws s3api put-public-access-block --bucket <your-S3-name> --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3 sync /home/yuwei/Documents/Cloud-Computing-Final/Frontend s3://<your-S3-name>

aws s3api put-bucket-policy --bucket <your-S3-name> --policy file://bucket-policy.json

aws s3 website s3://<your-S3-name>/ --index-document index.html

### Update S3
aws s3 sync /home/yuwei/Documents/Cloud-Computing-Final/Frontend s3://<your-S3-name>
