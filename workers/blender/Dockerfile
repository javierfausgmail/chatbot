FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends blender python3 python3-numpy \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY server.py generate_scene.py ./

EXPOSE 8010
CMD ["python3", "server.py"]
