package com.aistudio.housing.api

import com.aistudio.housing.model.FamilyVisitRequest
import retrofit2.http.GET

interface ApiService {
    @GET("family-visit")
    suspend fun getFamilyVisits(): List<FamilyVisitRequest>
}
