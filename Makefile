.PHONY: create update upload build

VERSION := 1.0.7
MODULE_NAME := sanding-monitoring-web-app
ORG_PUBLIC_NAMESPACE := ncs

build:
	npm run build

dev:
	npm run dev

create:
	viam module create --name=${MODULE_NAME} --public-namespace=${ORG_PUBLIC_NAMESPACE}

update:
	viam module update --module=meta.json

upload: build
	viam module upload --version=${VERSION} --platform=any --public-namespace=${ORG_PUBLIC_NAMESPACE} module

clean-all:
	git clean -fxd
