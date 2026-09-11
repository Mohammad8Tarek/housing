package com.aistudio.housing.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aistudio.housing.api.ApiService
import com.aistudio.housing.model.FamilyVisitRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class RequestViewModel(application: Application) : AndroidViewModel(application) {
    private val apiService = Retrofit.Builder()
        .baseUrl("http://resident.sunrise-resorts.com/api/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(ApiService::class.java)

    private val _allRequests = MutableStateFlow<List<FamilyVisitRequest>>(emptyList())
    val allRequests = _allRequests.asStateFlow()

    private val _statusCounts = MutableStateFlow<Map<String, Int>>(emptyMap())
    val statusCounts = _statusCounts.asStateFlow()

    init {
        fetchRequests()
        fetchCounts()
    }

    private fun fetchRequests() {
        viewModelScope.launch {
            try {
                _allRequests.value = apiService.getFamilyVisits()
            } catch (e: Exception) {
                // التعامل مع الأخطاء
            }
        }
    }

    private fun fetchCounts() {
        // سيتم إضافة المنطق الخاص بجلب الإحصائيات
    }
}
