#!/bin/bash
set -e

if [ -n "$(git status --porcelain)" ]; then
  echo "Your git directory is not clean, commit your changes before building";
  exit 1;
fi

BUILD_NUMBER=$(git rev-parse --short HEAD)
#build new docker image
docker build -t dockerhub.datacamp.com:443/rdocsv2:$BUILD_NUMBER .
#push image to docker registery
docker push dockerhub.datacamp.com:443/rdocsv2:$BUILD_NUMBER

sed -e "s/\$version/$BUILD_NUMBER/" -e "s/\$memory/1024/" < Dockerrun.aws.json.in > Dockerrun.aws.json

zip -r build/release.zip Dockerrun.aws.json proxy .ebextensions cron.yaml

eb deploy rdocsv2-workers
