package com.aistudio.housing.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aistudio.housing.viewmodel.RequestViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: RequestViewModel, onNavigateToDetail: (Int) -> Unit, onLogout: () -> Unit) {
    var selectedItem by remember { mutableIntStateOf(0) }
    val items = listOf("Dashboard", "Requests", "Profile")
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                items.forEachIndexed { index, item ->
                    NavigationBarItem(
                        icon = { Text(if(index == 0) "📊" else if(index == 1) "📋" else "👤") },
                        label = { Text(item) },
                        selected = selectedItem == index,
                        onClick = { selectedItem = index }
                    )
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            when (selectedItem) {
                0 -> Text("Dashboard Stats Content", modifier = Modifier.padding(16.dp))
                1 -> FamilyVisitList(viewModel, onNavigateToDetail)
                2 -> ProfileScreen(onLogout = onLogout)
            }
        }
    }
}

@Composable
fun FamilyVisitList(viewModel: RequestViewModel, onNavigateToDetail: (Int) -> Unit) {
    val requests by viewModel.allRequests.collectAsState()
    LazyColumn(modifier = Modifier.padding(16.dp)) {
        items(requests) { request ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                onClick = { onNavigateToDetail(request.id) }
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Request: ${request.requestNumber}", style = MaterialTheme.typography.titleMedium)
                    Text(text = "Status: ${request.status}")
                }
            }
        }
    }
}
