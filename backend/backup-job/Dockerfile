FROM postgres:18-alpine
RUN apk add --no-cache rclone ca-certificates bash
WORKDIR /app
COPY backup.sh ./
RUN chmod +x backup.sh
CMD ["/app/backup.sh"]
