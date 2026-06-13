FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy các file dự án để restore dependencies
COPY ["src/BPG.Api/BPG.Api.csproj", "src/BPG.Api/"]
COPY ["src/BPG.Application/BPG.Application.csproj", "src/BPG.Application/"]
COPY ["src/BPG.Domain/BPG.Domain.csproj", "src/BPG.Domain/"]
COPY ["src/BPG.Infrastructure/BPG.Infrastructure.csproj", "src/BPG.Infrastructure/"]

RUN dotnet restore "src/BPG.Api/BPG.Api.csproj"

# Copy phần còn lại của source code và tiến hành build
COPY . .
WORKDIR "/app/src/BPG.Api"
RUN dotnet build "BPG.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BPG.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "BPG.Api.dll"]
