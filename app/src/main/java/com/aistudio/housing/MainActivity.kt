package com.aistudio.housing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.*
import com.aistudio.housing.ui.LoginScreen
import com.aistudio.housing.ui.DashboardScreen
import com.aistudio.housing.viewmodel.RequestViewModel
import com.aistudio.housing.ui.theme.SunriseTheme

class MainActivity : ComponentActivity() {
    private val viewModel: RequestViewModel by viewModels()

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SunriseTheme {
                val navController = rememberNavController()
                NavHost(navController = navController, startDestination = "login") {
                    composable("login") { LoginScreen(onLoginSuccess = { navController.navigate("dashboard") }) }
                    composable("dashboard") { 
                        DashboardScreen(viewModel = viewModel, onNavigateToDetail = { id -> navController.navigate("detail/$id") }, onLogout = { 
                                navController.navigate("login") {
                                    popUpTo("dashboard") { inclusive = true }
                                }
                            }) 
                    }
                    composable("detail/{id}") { backStackEntry ->
                        val id = backStackEntry.arguments?.getString("id")?.toInt() ?: 0
                        Scaffold(topBar = { TopAppBar(title = { Text("Request Details") }) }) { padding ->
                            Text("Detail for $id", modifier = Modifier.padding(padding))
                        }
                    }
                }
            }
        }
    }
}
