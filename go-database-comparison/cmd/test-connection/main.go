package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go-database-comparison/pkg/database"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	config := database.DefaultPostgreSQLConfig()

	fmt.Println("🔍 Go Database Comparison - Connection Test")
	fmt.Println("==========================================")
	fmt.Printf("Go Version: %s\n", "1.24.1")
	fmt.Printf("Database: PostgreSQL\n")
	fmt.Printf("Host: %s:%d\n", config.Host, config.Port)
	fmt.Println()

	// Test all connections
	fmt.Println("🧪 Testing Database Connections...")
	
	if err := database.HealthCheck(ctx, config); err != nil {
		log.Fatalf("❌ Database health check failed: %v", err)
	}

	fmt.Println("✅ All database connections successful!")
	fmt.Println()

	// Individual connection tests with timing
	fmt.Println("⏱️  Connection Performance Test...")

	// Test PQ
	start := time.Now()
	pqDB, err := database.ConnectWithPQ(ctx, config)
	if err != nil {
		log.Fatalf("❌ PQ connection failed: %v", err)
	}
	pqDuration := time.Since(start)
	pqDB.Close()
	fmt.Printf("📊 PQ Connection Time: %v\n", pqDuration)

	// Test SQLX
	start = time.Now()
	sqlxDB, err := database.ConnectWithSQLX(ctx, config)
	if err != nil {
		log.Fatalf("❌ SQLX connection failed: %v", err)
	}
	sqlxDuration := time.Since(start)
	sqlxDB.Close()
	fmt.Printf("📊 SQLX Connection Time: %v\n", sqlxDuration)

	// Test GORM
	start = time.Now()
	gormDB, err := database.ConnectWithGORM(ctx, config)
	if err != nil {
		log.Fatalf("❌ GORM connection failed: %v", err)
	}
	gormDuration := time.Since(start)
	sqlDB, _ := gormDB.DB()
	sqlDB.Close()
	fmt.Printf("📊 GORM Connection Time: %v\n", gormDuration)

	fmt.Println()
	fmt.Println("✅ Environment setup completed successfully!")
	fmt.Println("📝 Ready for CRUD implementation and benchmarking")
}