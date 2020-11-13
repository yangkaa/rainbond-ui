#!/bin/bash
if [ -z "$VERSION" ];then
	if [ -z "$TRAVIS_TAG" ]; then
		VERSION=$TRAVIS_BRANCH-dev
	else
		VERSION=$TRAVIS_TAG
	fi
fi

BUILD_RBD_APP_UI=${BUILD_RBD_APP_UI:-true} 

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin 
docker build -t "yangk/rainbond-ui:$VERSION" .
docker push "yangk/rainbond-ui:$VERSION"


if [ ${BUILD_RBD_APP_UI} == "true" ];
then
	mv dist build/dist
	docker build --build-arg VERSION="${VERSION}" -t "yangk/rbd-app-ui:$VERSION" ./build
	docker push "yangk/rbd-app-ui:$VERSION"

	if [ ${DOMESTIC_BASE_NAME} ];
	then
		newTag="${DOMESTIC_BASE_NAME}/${DOMESTIC_NAMESPACE}/rbd-app-ui:${VERSION}"
		docker tag "yangk/rbd-app-ui:$VERSION" "${newTag}"
		docker login -u "$DOMESTIC_DOCKER_USERNAME" -p "$DOMESTIC_DOCKER_PASSWORD" ${DOMESTIC_BASE_NAME}
		docker push "${newTag}"
	fi
fi

