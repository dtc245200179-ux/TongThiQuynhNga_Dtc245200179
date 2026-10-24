FROM python:3.12-alpine

WORKDIR /app
RUN addgroup -S exporter && adduser -S -G exporter exporter
COPY exporter.py .
USER exporter

EXPOSE 9105
CMD ["python", "-u", "exporter.py"]
