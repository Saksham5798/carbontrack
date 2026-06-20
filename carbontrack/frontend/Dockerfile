# ============================================
# CarbonTrack Frontend Dockerfile (Nginx)
# ============================================

# Use official Nginx Alpine image for lightweight web server
FROM nginx:alpine

# Add metadata
LABEL maintainer="CarbonTrack Team"
LABEL description="Frontend Web Server for CarbonTrack Emissions Monitoring Cloud"

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the frontend application files to Nginx html directory
COPY ./ /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Nginx starts automatically
CMD ["nginx", "-g", "daemon off;"]
