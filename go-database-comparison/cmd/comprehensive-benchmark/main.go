package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"go-database-comparison/pkg/benchmark"
	"go-database-comparison/pkg/database"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	fmt.Println("🚀 Go Database Comparison - Comprehensive Benchmark")
	fmt.Println("=================================================")
	fmt.Printf("Timestamp: %s\n", time.Now().Format(time.RFC3339))

	// Initialize database configuration
	config := database.DefaultPostgreSQLConfig()

	// Health check
	if err := database.HealthCheck(ctx, config); err != nil {
		log.Fatalf("❌ Database health check failed: %v", err)
	}
	fmt.Println("✅ Database connectivity verified")

	// Configure benchmark
	benchConfig := benchmark.DefaultBenchmarkConfig()
	benchConfig.Iterations = 100 // Optimized for demonstration
	benchConfig.Concurrency = 3  // Conservative concurrency
	benchConfig.WarmupRounds = 50
	benchConfig.OperationTypes = []string{"create", "read"} // Simplified operations

	fmt.Printf("\n📊 Benchmark Configuration:\n")
	fmt.Printf("   Iterations: %d\n", benchConfig.Iterations)
	fmt.Printf("   Concurrency: %d\n", benchConfig.Concurrency)
	fmt.Printf("   Warmup Rounds: %d\n", benchConfig.WarmupRounds)
	fmt.Printf("   Operations: %v\n", benchConfig.OperationTypes)

	// Initialize benchmark
	perfBench := benchmark.NewPerformanceBenchmark(benchConfig)

	// Run comprehensive benchmark
	fmt.Println("\n🔥 Starting comprehensive performance benchmark...")
	start := time.Now()

	if err := perfBench.RunComprehensiveBenchmark(ctx, config); err != nil {
		log.Fatalf("❌ Benchmark failed: %v", err)
	}

	totalDuration := time.Since(start)
	fmt.Printf("\n✅ Benchmark completed in %v\n", totalDuration)

	// Generate and display results
	results := perfBench.GetResults()
	
	fmt.Println("\n📈 Performance Results Summary:")
	fmt.Println("================================")
	
	// Display results grouped by library
	libraries := []string{"PQ", "SQLX", "GORM"}
	
	for _, library := range libraries {
		fmt.Printf("\n🔍 %s Results:\n", library)
		fmt.Println("Operation    | Avg Time    | Ops/Sec | Success Rate")
		fmt.Println("-------------|-------------|---------|-------------")
		
		for _, result := range results {
			if result.Library == library {
				fmt.Printf("%-12s | %-11v | %7.1f | %10.1f%%\n",
					result.Operation, result.AvgTime, result.OpsPerSec, result.SuccessRate)
			}
		}
	}

	// Generate detailed report
	report := perfBench.GenerateReport()
	
	// Save results to file
	if err := saveResults(results, report); err != nil {
		log.Printf("⚠️  Failed to save results: %v", err)
	} else {
		fmt.Println("\n💾 Results saved to benchmark_results.json and benchmark_report.md")
	}

	// Display performance comparison
	fmt.Println("\n🏆 Performance Comparison Summary:")
	displayPerformanceComparison(results)

	// Display recommendations
	fmt.Println("\n💡 Performance Recommendations:")
	displayRecommendations(results)
}

func saveResults(results []benchmark.BenchmarkResult, report string) error {
	// Save JSON results
	jsonData, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	if err := os.WriteFile("benchmark_results.json", jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write JSON results: %w", err)
	}

	// Save markdown report
	if err := os.WriteFile("benchmark_report.md", []byte(report), 0644); err != nil {
		return fmt.Errorf("failed to write report: %w", err)
	}

	return nil
}

func displayPerformanceComparison(results []benchmark.BenchmarkResult) {
	// Group by operation
	operationResults := make(map[string][]benchmark.BenchmarkResult)
	for _, result := range results {
		operationResults[result.Operation] = append(operationResults[result.Operation], result)
	}

	for operation, opResults := range operationResults {
		if len(opResults) < 3 {
			continue // Need all three libraries for comparison
		}

		fmt.Printf("\n%s Operation Winner:\n", operation)
		
		// Find fastest by average time
		fastest := opResults[0]
		for _, result := range opResults[1:] {
			if result.AvgTime < fastest.AvgTime {
				fastest = result
			}
		}
		
		// Find highest throughput
		highestThroughput := opResults[0]
		for _, result := range opResults[1:] {
			if result.OpsPerSec > highestThroughput.OpsPerSec {
				highestThroughput = result
			}
		}

		fmt.Printf("   🥇 Fastest: %s (%v avg)\n", fastest.Library, fastest.AvgTime)
		fmt.Printf("   🚀 Highest Throughput: %s (%.1f ops/sec)\n", 
			highestThroughput.Library, highestThroughput.OpsPerSec)
	}
}

func displayRecommendations(results []benchmark.BenchmarkResult) {
	fmt.Println("   📚 For Learning/Prototyping:")
	fmt.Println("      → GORM: Rich ORM features, rapid development")
	
	fmt.Println("   ⚡ For High Performance:")
	fmt.Println("      → PQ: Raw SQL control, minimal overhead")
	
	fmt.Println("   🔧 For Balanced Approach:")
	fmt.Println("      → SQLX: Struct mapping + SQL flexibility")
	
	fmt.Println("   🏢 For Enterprise Applications:")
	fmt.Println("      → Context: All libraries support proper context handling")
	fmt.Println("      → Scaling: Choose based on specific bottlenecks")
	
	fmt.Println("   🔍 Performance Insights:")
	fmt.Println("      → Raw SQL (PQ) typically fastest for simple operations")
	fmt.Println("      → SQLX provides good balance of performance and usability")
	fmt.Println("      → GORM adds overhead but improves development velocity")
}