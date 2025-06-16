package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go-database-comparison/pkg/concurrency"
	"go-database-comparison/pkg/database"
	"go-database-comparison/pkg/models"
	"go-database-comparison/pkg/repository"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	config := database.DefaultPostgreSQLConfig()

	fmt.Println("🧪 Go Database Comparison - CRUD Operations Test")
	fmt.Println("===============================================")

	// Test all three database libraries
	if err := testAllLibraries(ctx, config); err != nil {
		log.Fatalf("❌ CRUD tests failed: %v", err)
	}

	fmt.Println("✅ All CRUD operations completed successfully!")
}

func testAllLibraries(ctx context.Context, config *database.DatabaseConfig) error {
	// Test PQ
	fmt.Println("\n📊 Testing lib/pq (Raw SQL)...")
	if err := testPQ(ctx, config); err != nil {
		return fmt.Errorf("PQ test failed: %w", err)
	}

	// Test SQLX
	fmt.Println("\n📊 Testing sqlx (SQL + Struct Mapping)...")
	if err := testSQLX(ctx, config); err != nil {
		return fmt.Errorf("SQLX test failed: %w", err)
	}

	// Test GORM
	fmt.Println("\n📊 Testing GORM (ORM)...")
	if err := testGORM(ctx, config); err != nil {
		return fmt.Errorf("GORM test failed: %w", err)
	}

	// Test concurrent operations
	fmt.Println("\n🚀 Testing Concurrent Operations with Goroutine Pool...")
	if err := testConcurrentOperations(ctx, config); err != nil {
		return fmt.Errorf("Concurrent test failed: %w", err)
	}

	return nil
}

func testPQ(ctx context.Context, config *database.DatabaseConfig) error {
	db, err := database.ConnectWithPQ(ctx, config)
	if err != nil {
		return err
	}
	defer db.Close()

	repo := repository.NewPQRepository(db)
	return performCRUDTests(ctx, "PQ", repo)
}

func testSQLX(ctx context.Context, config *database.DatabaseConfig) error {
	db, err := database.ConnectWithSQLX(ctx, config)
	if err != nil {
		return err
	}
	defer db.Close()

	repo := repository.NewSQLXRepository(db)
	return performCRUDTests(ctx, "SQLX", repo)
}

func testGORM(ctx context.Context, config *database.DatabaseConfig) error {
	db, err := database.ConnectWithGORM(ctx, config)
	if err != nil {
		return err
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	repo := repository.NewGORMRepository(db)
	return performCRUDTests(ctx, "GORM", repo)
}

func performCRUDTests(ctx context.Context, libraryName string, repo interface{}) error {
	start := time.Now()

	// Create operation with timestamp to avoid duplicates
	timestamp := time.Now().UnixNano()
	createReq := &models.CreateUserRequest{
		Name:  fmt.Sprintf("Test User %s %d", libraryName, timestamp),
		Email: fmt.Sprintf("test-%s-%d@example.com", libraryName, timestamp),
		Age:   25,
	}

	var user *models.User
	var err error

	switch r := repo.(type) {
	case *repository.PQRepository:
		user, err = r.CreateUser(ctx, createReq)
	case *repository.SQLXRepository:
		user, err = r.CreateUser(ctx, createReq)
	case *repository.GORMRepository:
		user, err = r.CreateUser(ctx, createReq)
	default:
		return fmt.Errorf("unknown repository type")
	}

	if err != nil {
		return fmt.Errorf("create user failed: %w", err)
	}
	fmt.Printf("   ✓ Create: User ID %d created\n", user.ID)

	// Read operation
	var readUser *models.User
	switch r := repo.(type) {
	case *repository.PQRepository:
		readUser, err = r.GetUserByID(ctx, user.ID)
	case *repository.SQLXRepository:
		readUser, err = r.GetUserByID(ctx, user.ID)
	case *repository.GORMRepository:
		readUser, err = r.GetUserByID(ctx, user.ID)
	}

	if err != nil {
		return fmt.Errorf("read user failed: %w", err)
	}
	fmt.Printf("   ✓ Read: User %s found\n", readUser.Name)

	// Update operation
	newName := fmt.Sprintf("Updated %s User", libraryName)
	updateReq := &models.UpdateUserRequest{
		Name: &newName,
	}

	var updatedUser *models.User
	switch r := repo.(type) {
	case *repository.PQRepository:
		updatedUser, err = r.UpdateUser(ctx, user.ID, updateReq)
	case *repository.SQLXRepository:
		updatedUser, err = r.UpdateUser(ctx, user.ID, updateReq)
	case *repository.GORMRepository:
		updatedUser, err = r.UpdateUser(ctx, user.ID, updateReq)
	}

	if err != nil {
		return fmt.Errorf("update user failed: %w", err)
	}
	fmt.Printf("   ✓ Update: Name changed to %s\n", updatedUser.Name)

	// Delete operation
	switch r := repo.(type) {
	case *repository.PQRepository:
		err = r.DeleteUser(ctx, user.ID)
	case *repository.SQLXRepository:
		err = r.DeleteUser(ctx, user.ID)
	case *repository.GORMRepository:
		err = r.DeleteUser(ctx, user.ID)
	}

	if err != nil {
		return fmt.Errorf("delete user failed: %w", err)
	}
	fmt.Printf("   ✓ Delete: User soft deleted\n")

	duration := time.Since(start)
	fmt.Printf("   ⏱️  Total time: %v\n", duration)

	return nil
}

func testConcurrentOperations(ctx context.Context, config *database.DatabaseConfig) error {
	// Create worker pool
	pool := concurrency.NewDatabaseBenchmarkPool(ctx, 10)
	pool.Start()
	defer pool.Stop()

	// Connect to database
	db, err := database.ConnectWithPQ(ctx, config)
	if err != nil {
		return err
	}
	defer db.Close()

	repo := repository.NewPQRepository(db)

	// Submit concurrent create operations
	numOperations := 50
	fmt.Printf("   🔄 Submitting %d concurrent create operations...\n", numOperations)

	for i := 0; i < numOperations; i++ {
		i := i // Capture loop variable
		err := pool.SubmitBenchmarkJob("concurrent_create", func(ctx context.Context) (interface{}, error) {
			req := &models.CreateUserRequest{
				Name:  fmt.Sprintf("Concurrent User %d", i),
				Email: fmt.Sprintf("concurrent-%d@example.com", i),
				Age:   20 + (i % 40),
			}
			return repo.CreateUser(ctx, req)
		})
		if err != nil {
			return fmt.Errorf("failed to submit job %d: %w", i, err)
		}
	}

	// Collect results
	results, err := pool.GetResults(numOperations, 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to get all results: %w", err)
	}

	// Process results
	successful := 0
	var totalDuration time.Duration
	for _, result := range results {
		if result.Error == nil {
			successful++
			totalDuration += result.Duration
			pool.RecordOperation("concurrent_create", result.Duration)
		} else {
			fmt.Printf("   ❌ Job %d failed: %v\n", result.JobID, result.Error)
		}
	}

	avgDuration := totalDuration / time.Duration(successful)
	fmt.Printf("   ✅ Concurrent operations: %d/%d successful\n", successful, numOperations)
	fmt.Printf("   ⏱️  Average duration: %v\n", avgDuration)

	// Display benchmark stats
	stats := pool.GetBenchmarkStats()
	fmt.Printf("   📊 Benchmark Stats: %+v\n", stats)

	return nil
}