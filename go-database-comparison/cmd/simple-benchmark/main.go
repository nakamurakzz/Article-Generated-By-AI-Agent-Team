package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go-database-comparison/pkg/database"
	"go-database-comparison/pkg/models"
	"go-database-comparison/pkg/repository"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	fmt.Println("🚀 Go Database Comparison - Simple Performance Test")
	fmt.Println("=================================================")

	config := database.DefaultPostgreSQLConfig()

	// Test all three libraries
	if err := benchmarkAllLibraries(ctx, config); err != nil {
		log.Fatalf("❌ Benchmark failed: %v", err)
	}

	fmt.Println("✅ Performance benchmark completed successfully!")
}

func benchmarkAllLibraries(ctx context.Context, config *database.DatabaseConfig) error {
	libraries := []string{"PQ", "SQLX", "GORM"}
	results := make(map[string]map[string]time.Duration)

	for _, lib := range libraries {
		fmt.Printf("\n📊 Benchmarking %s...\n", lib)
		
		libResults, err := benchmarkLibrary(ctx, lib, config)
		if err != nil {
			return fmt.Errorf("benchmark failed for %s: %w", lib, err)
		}
		
		results[lib] = libResults
		
		for operation, duration := range libResults {
			fmt.Printf("   %s: %v\n", operation, duration)
		}
	}

	// Display comparison
	fmt.Println("\n🏆 Performance Comparison:")
	fmt.Println("================================")
	fmt.Printf("%-10s | %-12s | %-12s | %-12s\n", "Library", "Create", "Read", "Update")
	fmt.Println("-----------|--------------|--------------|-------------")
	
	for _, lib := range libraries {
		fmt.Printf("%-10s | %-12v | %-12v | %-12v\n", 
			lib, 
			results[lib]["create"],
			results[lib]["read"],
			results[lib]["update"])
	}

	return nil
}

func benchmarkLibrary(ctx context.Context, library string, config *database.DatabaseConfig) (map[string]time.Duration, error) {
	results := make(map[string]time.Duration)
	
	// Connect to database
	var repo interface{}
	var cleanup func()

	switch library {
	case "PQ":
		db, err := database.ConnectWithPQ(ctx, config)
		if err != nil {
			return nil, err
		}
		repo = repository.NewPQRepository(db)
		cleanup = func() { db.Close() }
	case "SQLX":
		db, err := database.ConnectWithSQLX(ctx, config)
		if err != nil {
			return nil, err
		}
		repo = repository.NewSQLXRepository(db)
		cleanup = func() { db.Close() }
	case "GORM":
		db, err := database.ConnectWithGORM(ctx, config)
		if err != nil {
			return nil, err
		}
		repo = repository.NewGORMRepository(db)
		cleanup = func() { 
			sqlDB, _ := db.DB()
			sqlDB.Close()
		}
	default:
		return nil, fmt.Errorf("unknown library: %s", library)
	}
	defer cleanup()

	// Benchmark create operation
	createDuration, err := benchmarkCreate(ctx, library, repo, 50)
	if err != nil {
		return nil, fmt.Errorf("create benchmark failed: %w", err)
	}
	results["create"] = createDuration

	// Benchmark read operation
	readDuration, err := benchmarkRead(ctx, library, repo, 50)
	if err != nil {
		return nil, fmt.Errorf("read benchmark failed: %w", err)
	}
	results["read"] = readDuration

	// Benchmark update operation
	updateDuration, err := benchmarkUpdate(ctx, library, repo, 50)
	if err != nil {
		return nil, fmt.Errorf("update benchmark failed: %w", err)
	}
	results["update"] = updateDuration

	return results, nil
}

func benchmarkCreate(ctx context.Context, library string, repo interface{}, iterations int) (time.Duration, error) {
	start := time.Now()
	
	for i := 0; i < iterations; i++ {
		timestamp := time.Now().UnixNano() + int64(i)
		req := &models.CreateUserRequest{
			Name:  fmt.Sprintf("Bench %s %d", library, timestamp),
			Email: fmt.Sprintf("bench-%s-%d@test.com", library, timestamp),
			Age:   25 + (i % 50),
		}

		var err error
		switch r := repo.(type) {
		case *repository.PQRepository:
			_, err = r.CreateUser(ctx, req)
		case *repository.SQLXRepository:
			_, err = r.CreateUser(ctx, req)
		case *repository.GORMRepository:
			_, err = r.CreateUser(ctx, req)
		}

		if err != nil {
			return 0, err
		}
	}

	return time.Since(start) / time.Duration(iterations), nil
}

func benchmarkRead(ctx context.Context, library string, repo interface{}, iterations int) (time.Duration, error) {
	// First create some test data
	var testUserIDs []int
	for i := 0; i < 10; i++ {
		timestamp := time.Now().UnixNano() + int64(i)
		req := &models.CreateUserRequest{
			Name:  fmt.Sprintf("ReadTest %s %d", library, timestamp),
			Email: fmt.Sprintf("readtest-%s-%d@test.com", library, timestamp),
			Age:   25,
		}

		var user *models.User
		var err error

		switch r := repo.(type) {
		case *repository.PQRepository:
			user, err = r.CreateUser(ctx, req)
		case *repository.SQLXRepository:
			user, err = r.CreateUser(ctx, req)
		case *repository.GORMRepository:
			user, err = r.CreateUser(ctx, req)
		}

		if err == nil {
			testUserIDs = append(testUserIDs, user.ID)
		}
	}

	if len(testUserIDs) == 0 {
		return 0, fmt.Errorf("no test users created")
	}

	// Benchmark read operations
	start := time.Now()
	
	for i := 0; i < iterations; i++ {
		userID := testUserIDs[i%len(testUserIDs)]
		
		var err error
		switch r := repo.(type) {
		case *repository.PQRepository:
			_, err = r.GetUserByID(ctx, userID)
		case *repository.SQLXRepository:
			_, err = r.GetUserByID(ctx, userID)
		case *repository.GORMRepository:
			_, err = r.GetUserByID(ctx, userID)
		}

		if err != nil {
			return 0, err
		}
	}

	duration := time.Since(start) / time.Duration(iterations)

	// Cleanup test users
	for _, userID := range testUserIDs {
		switch r := repo.(type) {
		case *repository.PQRepository:
			r.DeleteUser(ctx, userID)
		case *repository.SQLXRepository:
			r.DeleteUser(ctx, userID)
		case *repository.GORMRepository:
			r.DeleteUser(ctx, userID)
		}
	}

	return duration, nil
}

func benchmarkUpdate(ctx context.Context, library string, repo interface{}, iterations int) (time.Duration, error) {
	// Create test user
	timestamp := time.Now().UnixNano()
	req := &models.CreateUserRequest{
		Name:  fmt.Sprintf("UpdateTest %s %d", library, timestamp),
		Email: fmt.Sprintf("updatetest-%s-%d@test.com", library, timestamp),
		Age:   25,
	}

	var user *models.User
	var err error

	switch r := repo.(type) {
	case *repository.PQRepository:
		user, err = r.CreateUser(ctx, req)
	case *repository.SQLXRepository:
		user, err = r.CreateUser(ctx, req)
	case *repository.GORMRepository:
		user, err = r.CreateUser(ctx, req)
	}

	if err != nil {
		return 0, fmt.Errorf("failed to create test user: %w", err)
	}

	// Benchmark update operations
	start := time.Now()
	
	for i := 0; i < iterations; i++ {
		newName := fmt.Sprintf("Updated %s %d", library, i)
		updateReq := &models.UpdateUserRequest{
			Name: &newName,
		}

		switch r := repo.(type) {
		case *repository.PQRepository:
			_, err = r.UpdateUser(ctx, user.ID, updateReq)
		case *repository.SQLXRepository:
			_, err = r.UpdateUser(ctx, user.ID, updateReq)
		case *repository.GORMRepository:
			_, err = r.UpdateUser(ctx, user.ID, updateReq)
		}

		if err != nil {
			return 0, err
		}
	}

	duration := time.Since(start) / time.Duration(iterations)

	// Cleanup
	switch r := repo.(type) {
	case *repository.PQRepository:
		r.DeleteUser(ctx, user.ID)
	case *repository.SQLXRepository:
		r.DeleteUser(ctx, user.ID)
	case *repository.GORMRepository:
		r.DeleteUser(ctx, user.ID)
	}

	return duration, nil
}