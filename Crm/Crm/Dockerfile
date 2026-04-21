# Build Image
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY CabtechCrm.Api/CabtechCrm.Api.csproj ./CabtechCrm.Api/
RUN dotnet restore CabtechCrm.Api/CabtechCrm.Api.csproj

# Copy everything else and build
COPY CabtechCrm.Api/ ./CabtechCrm.Api/
WORKDIR /app/CabtechCrm.Api
RUN dotnet publish -c Release -o out

# Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/CabtechCrm.Api/out .

# Use Render's PORT environment variable
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}

ENTRYPOINT ["dotnet", "CabtechCrm.Api.dll"]
