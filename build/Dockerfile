ARG VERSION=V5.2-dev
FROM yangk/rbd-app-ui:${VERSION}
ADD dist /dist
RUN mv /dist/index.html /app/ui/www/templates/index.html && \
  rm -rf /app/ui/www/static/dists/* && \
  cp -a /dist/* /app/ui/www/static/dists/ && \
  rm -rf /app/ui/static/dists/* && \
  cp -a /dist/* /app/ui/static/dists/ && \
  rm -rf /dist
