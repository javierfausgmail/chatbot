FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends blender python3 python3-numpy python3-debugpy \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
COPY server.py generate_scene.py ./

EXPOSE 8010 5678
CMD ["python3", "server.py"]
