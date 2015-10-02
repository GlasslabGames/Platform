#!/bin/bash

# if node_modules missing then install
if [ ! -d "node_modules" ]; then
	npm install
fi

node proxy.js
